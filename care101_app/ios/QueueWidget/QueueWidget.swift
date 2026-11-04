import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Shared storage (same keys as QueueWidgetModule in the app)

enum WidgetStore {
  static let appGroup = "group.com.damiduuofc.carelinkdoctorapp"
  static let keyWidgetData = "widget_data_json"
  static let keySyncedAt = "widget_synced_at_ms"
  static let keyAuthToken = "auth_token"
  static let keyApiUrl = "api_url"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static func load() -> QueueData {
    guard let d = defaults,
          let json = d.string(forKey: keyWidgetData),
          let data = json.data(using: .utf8),
          let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    else { return .empty }
    var q = QueueData(obj)
    // A "today" payload synced before local midnight is from a previous day: don't show it.
    let syncedAt = d.double(forKey: keySyncedAt) / 1000
    let isTodayPayload = q.state == "queue" ||
      (q.state == "upcoming" && q.formattedDate.caseInsensitiveCompare("Today") == .orderedSame)
    if isTodayPayload, syncedAt > 0,
       Date(timeIntervalSince1970: syncedAt) < Calendar.current.startOfDay(for: Date()) {
      q.state = "empty"
    }
    return q
  }

  /// Fetches /appointments/widget-status with the token the app saved. Returns true on any change.
  @discardableResult
  static func refreshFromServer() async -> Bool {
    guard let d = defaults,
          let token = d.string(forKey: keyAuthToken), !token.isEmpty,
          let api = d.string(forKey: keyApiUrl), !api.isEmpty else { return false }
    let base = api.hasSuffix("/") ? String(api.dropLast()) : api
    guard let url = URL(string: "\(base)/appointments/widget-status") else { return false }
    var req = URLRequest(url: url, timeoutInterval: 8)
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("true", forHTTPHeaderField: "ngrok-skip-browser-warning")
    do {
      let (data, resp) = try await URLSession.shared.data(for: req)
      let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
      if status == 401 {
        d.removeObject(forKey: keyWidgetData)
        d.removeObject(forKey: keyAuthToken)
        return true
      }
      guard status == 200,
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
            obj["state"] != nil,
            let json = String(data: data, encoding: .utf8) else { return false }
      d.set(json, forKey: keyWidgetData)
      d.set(Date().timeIntervalSince1970 * 1000, forKey: keySyncedAt)
      return true
    } catch {
      return false // keep last known state on network failure
    }
  }
}

// MARK: - Model

struct QueueData {
  var state: String
  var hospitalName, doctorName, room, myToken, ongoingToken: String
  var peopleAhead: Int
  var awaitingPayment, isArrived, isDelayed, hasUpcoming: Bool
  var delayMessage, channelingStatus, formattedDate, channelingTime: String
  var nextDoctorName, nextHospitalName, nextRoom, nextToken, nextDate: String

  static let empty = QueueData([:])

  init(_ d: [String: Any]) {
    func s(_ k: String, _ f: String = "") -> String {
      guard let v = d[k], !(v is NSNull) else { return f }
      let out = "\(v)"
      return out.isEmpty ? f : out
    }
    func b(_ k: String) -> Bool { (d[k] as? NSNumber)?.boolValue ?? false }
    state = s("state", "empty")
    hospitalName = s("hospitalName", "SUWASEWANA HOSPITAL").uppercased()
    doctorName = QueueData.formatDoctor(s("doctorName"))
    room = s("room", "Room TBA")
    myToken = QueueData.formatToken(s("myToken", "--"))
    ongoingToken = QueueData.formatToken(s("ongoingToken", "--"))
    peopleAhead = (d["peopleAhead"] as? NSNumber)?.intValue ?? Int(s("peopleAhead")) ?? 0
    awaitingPayment = b("awaitingPayment")
    isArrived = b("isArrived")
    isDelayed = b("isDelayed")
    hasUpcoming = b("hasUpcoming")
    delayMessage = s("delayMessage")
    channelingStatus = s("channelingStatus")
    formattedDate = s("formattedDate", "Today")
    channelingTime = s("channelingTime")
    nextDoctorName = QueueData.formatDoctor(s("nextDoctorName"))
    nextHospitalName = s("nextHospitalName", "Suwasewana Hospital")
    nextRoom = s("nextRoom", "Room TBA")
    nextToken = QueueData.formatToken(s("nextToken", "--"))
    nextDate = s("nextDate")
  }

  static func formatDoctor(_ raw: String) -> String {
    let t = raw.trimmingCharacters(in: .whitespaces)
    if t.isEmpty || t.lowercased() == "null" { return "Doctor" }
    let stripped = t.replacingOccurrences(of: "^[Dd][Rr]\\.?\\s*", with: "", options: .regularExpression)
      .trimmingCharacters(in: .whitespaces)
    if stripped.isEmpty || stripped.lowercased() == "doctor" { return "Doctor" }
    return "Dr. \(stripped)"
  }

  static func formatToken(_ raw: String) -> String {
    if let n = Int(raw), (1...9).contains(n) { return String(format: "%02d", n) }
    return raw
  }
}

// MARK: - Timeline

struct QueueEntry: TimelineEntry {
  let date: Date
  let data: QueueData
}

struct QueueProvider: TimelineProvider {
  func placeholder(in context: Context) -> QueueEntry {
    QueueEntry(date: Date(), data: QueueData([
      "state": "queue", "doctorName": "Perera", "room": "Room 04",
      "myToken": 12, "ongoingToken": 9, "peopleAhead": 3,
    ]))
  }

  func getSnapshot(in context: Context, completion: @escaping (QueueEntry) -> Void) {
    let current = WidgetStore.load()
    completion(context.isPreview && current.state == "empty" ? placeholder(in: context)
                                                             : QueueEntry(date: Date(), data: current))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<QueueEntry>) -> Void) {
    Task {
      await WidgetStore.refreshFromServer()
      let entry = QueueEntry(date: Date(), data: WidgetStore.load())
      // Live queues move quickly; poll more often while a session is running.
      let minutes = entry.data.state == "queue" ? 5 : 15
      let next = Calendar.current.date(byAdding: .minute, value: minutes, to: Date())!
      completion(Timeline(entries: [entry], policy: .after(next)))
    }
  }
}

// MARK: - Refresh button (iOS 17+)

@available(iOS 17.0, *)
struct RefreshQueueIntent: AppIntent {
  static var title: LocalizedStringResource = "Refresh Queue"
  func perform() async throws -> some IntentResult {
    await WidgetStore.refreshFromServer()
    return .result()
  }
}

// MARK: - Palette (matches the Android widget)

extension Color {
  init(hex: UInt32) {
    self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255)
  }
  static let brand = Color(hex: 0x0891B2)
  static let brandDark = Color(hex: 0x155E75)
  static let ink = Color(hex: 0x0F172A)
  static let muted = Color(hex: 0x64748B)
  static let amberBg = Color(hex: 0xFFEDD5)
  static let amberText = Color(hex: 0xC2410C)
  static let amberTitle = Color(hex: 0x9A3412)
  static let greenBg = Color(hex: 0xD1FAE5)
  static let greenText = Color(hex: 0x047857)
  static let greenTitle = Color(hex: 0x065F46)
  static let cyanBg = Color(hex: 0xCFFAFE)
  static let cyanText = Color(hex: 0x0E7490)
  static let liveRed = Color(hex: 0xDC2626)
}

// MARK: - Views

struct Badge: View {
  let text: String
  let fg: Color
  let bg: Color
  var body: some View {
    Text(text)
      .font(.system(size: 9, weight: .heavy))
      .foregroundColor(fg)
      .padding(.horizontal, 6).padding(.vertical, 3)
      .background(Capsule().fill(bg))
  }
}

struct RefreshButton: View {
  var body: some View {
    if #available(iOS 17.0, *) {
      Button(intent: RefreshQueueIntent()) {
        Image(systemName: "arrow.clockwise")
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(.brand)
      }
      .buttonStyle(.plain)
    }
  }
}

struct Header: View {
  let hospital: String
  let room: String
  let badge: Badge
  var body: some View {
    HStack(spacing: 6) {
      VStack(alignment: .leading, spacing: 1) {
        Text(hospital).font(.system(size: 10, weight: .heavy)).foregroundColor(.brandDark).lineLimit(1)
        Text(room).font(.system(size: 10, weight: .medium)).foregroundColor(.muted).lineLimit(1)
      }
      Spacer(minLength: 4)
      badge
      RefreshButton()
    }
  }
}

struct TokenTile: View {
  let label: String
  let value: String
  let tint: Color
  var body: some View {
    VStack(spacing: 2) {
      Text(label).font(.system(size: 9, weight: .bold)).foregroundColor(.muted)
      Text(value).font(.system(size: 24, weight: .black, design: .rounded)).foregroundColor(tint)
        .minimumScaleFactor(0.6).lineLimit(1)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 6)
    .background(RoundedRectangle(cornerRadius: 10).fill(tint.opacity(0.08)))
  }
}

struct Banner: View {
  let icon: String
  let title: String
  let text: String
  let titleColor: Color
  let textColor: Color
  let bg: Color
  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundColor(textColor)
      Text(title).font(.system(size: 10, weight: .heavy)).foregroundColor(titleColor)
      Text(text).font(.system(size: 10, weight: .medium)).foregroundColor(textColor).lineLimit(1)
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 8).padding(.vertical, 5)
    .background(RoundedRectangle(cornerRadius: 8).fill(bg))
  }
}

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 6) {
      Image("WidgetLogo").resizable().scaledToFit().frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 10))
      Text("carelink 101").font(.system(size: 13, weight: .heavy)).foregroundColor(.brandDark)
      Text("No appointments today").font(.system(size: 10)).foregroundColor(.muted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct QueueStateView: View {
  let d: QueueData
  let compact: Bool
  var waitStatus: String {
    var s: String
    if d.peopleAhead <= 0 { s = "Your Turn is Now! Proceed to \(d.room)" }
    else if d.peopleAhead == 1 { s = "1 Patient Ahead of You • Get Ready" }
    else { s = "\(d.peopleAhead) Patients Ahead of You" }
    if d.isDelayed && !d.channelingStatus.isEmpty && d.channelingStatus.lowercased() != "on time" {
      s += " • \(d.channelingStatus)"
    }
    return s
  }
  var body: some View {
    let badge = d.isDelayed ? Badge(text: "● DELAYED", fg: .amberText, bg: .amberBg)
                            : Badge(text: "● LIVE NOW", fg: .white, bg: .liveRed)
    VStack(alignment: .leading, spacing: 6) {
      if compact {
        HStack { badge; Spacer(); RefreshButton() }
        Text(d.doctorName).font(.system(size: 12, weight: .bold)).foregroundColor(.ink).lineLimit(1)
        HStack(spacing: 6) {
          TokenTile(label: "YOU", value: "#\(d.myToken)", tint: .brand)
          TokenTile(label: "NOW", value: "#\(d.ongoingToken)", tint: .liveRed)
        }
        Text(waitStatus).font(.system(size: 9, weight: .semibold)).foregroundColor(.brandDark).lineLimit(2)
      } else {
        Header(hospital: d.hospitalName, room: d.room, badge: badge)
        Text(d.doctorName).font(.system(size: 14, weight: .bold)).foregroundColor(.ink).lineLimit(1)
        HStack(spacing: 8) {
          TokenTile(label: "MY TOKEN", value: "#\(d.myToken)", tint: .brand)
          TokenTile(label: "ONGOING", value: "#\(d.ongoingToken)", tint: .liveRed)
        }
        Text(waitStatus).font(.system(size: 11, weight: .semibold)).foregroundColor(.brandDark).lineLimit(1)
      }
    }
  }
}

struct UpcomingStateView: View {
  let d: QueueData
  let compact: Bool

  var scheduleLine: String {
    let t = d.channelingTime
    let lower = t.lowercased()
    return (!t.isEmpty && lower != "scheduled today" && lower != "scheduled")
      ? "\(d.formattedDate) • \(t)" : "\(d.formattedDate) • Scheduled"
  }

  var status: (badge: Badge, banner: Banner) {
    let delayed = d.isDelayed && !d.isArrived
    if d.awaitingPayment {
      return (Badge(text: "● UNPAID", fg: .amberText, bg: .amberBg),
              Banner(icon: "exclamationmark.triangle.fill", title: "AWAITING PAYMENT:",
                     text: "Pay the fee to get your token", titleColor: .amberTitle, textColor: .amberText, bg: .amberBg))
    } else if d.isArrived {
      return (Badge(text: "● ARRIVED", fg: .greenText, bg: .greenBg),
              Banner(icon: "checkmark.circle.fill", title: "DOCTOR ARRIVED:",
                     text: "At \(d.room) • Session starting soon", titleColor: .greenTitle, textColor: .greenText, bg: .greenBg))
    } else if delayed {
      let msg: String
      if !d.channelingStatus.isEmpty && d.channelingStatus.lowercased() != "on time" { msg = d.channelingStatus }
      else if d.delayMessage.lowercased().hasPrefix("doctor delayed:") {
        msg = d.delayMessage.split(separator: ":", maxSplits: 1).last.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
      } else if !d.delayMessage.isEmpty { msg = d.delayMessage }
      else { msg = "Session start is delayed" }
      return (Badge(text: "● DELAYED", fg: .amberText, bg: .amberBg),
              Banner(icon: "exclamationmark.triangle.fill", title: "DELAY NOTICE:",
                     text: msg, titleColor: .amberTitle, textColor: .amberText, bg: .amberBg))
    } else {
      return (Badge(text: "● ON TIME", fg: .cyanText, bg: .cyanBg),
              Banner(icon: "checkmark.circle.fill", title: "ON SCHEDULE:",
                     text: "Doctor on time • Waiting to arrive", titleColor: .brandDark, textColor: .cyanText, bg: .cyanBg))
    }
  }

  var body: some View {
    let s = status
    let token = d.awaitingPayment ? "--" : "#\(d.myToken)"
    VStack(alignment: .leading, spacing: 6) {
      if compact {
        HStack { s.badge; Spacer(); RefreshButton() }
        Text(d.doctorName).font(.system(size: 12, weight: .bold)).foregroundColor(.ink).lineLimit(1)
        Text(scheduleLine).font(.system(size: 9)).foregroundColor(.muted).lineLimit(1)
        TokenTile(label: "MY TOKEN", value: token, tint: .brand)
        Text(d.room).font(.system(size: 9, weight: .semibold)).foregroundColor(.brandDark).lineLimit(1)
      } else {
        Header(hospital: d.hospitalName, room: d.room, badge: s.badge)
        HStack(spacing: 8) {
          VStack(alignment: .leading, spacing: 2) {
            Text(d.doctorName).font(.system(size: 14, weight: .bold)).foregroundColor(.ink).lineLimit(1)
            Text(scheduleLine).font(.system(size: 10)).foregroundColor(.muted).lineLimit(1)
          }
          Spacer(minLength: 4)
          TokenTile(label: "MY TOKEN", value: token, tint: .brand).frame(width: 90)
        }
        s.banner
      }
    }
  }
}

struct CompletedStateView: View {
  let d: QueueData
  let compact: Bool
  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 4 : 6) {
      HStack {
        Badge(text: "✓ DONE TODAY", fg: .greenText, bg: .greenBg)
        Spacer()
        RefreshButton()
      }
      Text("NEXT APPOINTMENT").font(.system(size: 9, weight: .heavy)).foregroundColor(.muted)
      Text(d.nextDoctorName).font(.system(size: compact ? 12 : 14, weight: .bold)).foregroundColor(.ink).lineLimit(1)
      Text("Token #\(d.nextToken)").font(.system(size: compact ? 11 : 13, weight: .heavy)).foregroundColor(.brand)
      Text("\(d.nextHospitalName) • \(d.nextRoom)").font(.system(size: 10)).foregroundColor(.muted).lineLimit(1)
      if !d.nextDate.isEmpty {
        Text("Date: \(d.nextDate)").font(.system(size: 10, weight: .semibold)).foregroundColor(.brandDark).lineLimit(1)
      }
    }
  }
}

struct QueueWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: QueueEntry

  var body: some View {
    let d = entry.data
    let compact = family == .systemSmall
    Group {
      switch d.state {
      case "queue": QueueStateView(d: d, compact: compact)
      case "upcoming": UpcomingStateView(d: d, compact: compact)
      case "completed" where d.hasUpcoming: CompletedStateView(d: d, compact: compact)
      default: EmptyStateView()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(URL(string: "carelink://patient-dashboard"))
    .widgetBackground(Color.white)
  }
}

extension View {
  @ViewBuilder
  func widgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(color, for: .widget)
    } else {
      padding().background(color)
    }
  }
}

// MARK: - Widget

struct QueueWidget: Widget {
  let kind = "QueueWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: QueueProvider()) { entry in
      QueueWidgetView(entry: entry)
    }
    .configurationDisplayName("Live Queue")
    .description("Track your token, the ongoing token and doctor status at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct QueueWidgetBundle: WidgetBundle {
  var body: some Widget { QueueWidget() }
}
