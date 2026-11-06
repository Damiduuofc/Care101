import WidgetKit
import SwiftUI
import AppIntents
import ActivityKit

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

// iOS runs this inside the app (a LiveActivityIntent), where a same-named copy in
// QueueWidgetModule.swift also updates the Live Activity and posts alerts. This copy is
// only the fallback if the system runs it in the extension.
@available(iOS 17.0, *)
struct RefreshQueueIntent: LiveActivityIntent {
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

// MARK: - Live Activity (Lock Screen + Dynamic Island)

/// Keep identical to the copy in carelinkdoctorapp/QueueWidgetModule.swift (and to
/// liveActivityContentState in backend/utils/iosPush.js).
@available(iOS 16.1, *)
struct QueueActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var state: String
    var myToken: String
    var ongoingToken: String
    var peopleAhead: Int
    var room: String
    var channelingStatus: String
    var channelingTime: String
    var isArrived: Bool
    var isDelayed: Bool
    var awaitingPayment: Bool
  }

  var appointmentId: String
  var doctorName: String
  var hospitalName: String
}

@available(iOS 16.1, *)
struct LiveQueueInfo {
  let s: QueueActivityAttributes.ContentState

  var myToken: String { s.awaitingPayment ? "--" : "#" + QueueData.formatToken(s.myToken) }
  var ongoing: String { "#" + QueueData.formatToken(s.ongoingToken) }
  var inQueue: Bool { s.state == "queue" }
  var done: Bool { s.state == "completed" || s.state == "empty" }
  var isYourTurn: Bool { inQueue && s.peopleAhead <= 0 }
  var delayText: String {
    let st = s.channelingStatus
    return st.isEmpty || st.lowercased() == "on time" ? "Session start is delayed" : st
  }

  var badge: (text: String, fg: Color, bg: Color) {
    if done { return ("✓ DONE", .greenText, .greenBg) }
    if s.awaitingPayment { return ("● UNPAID", .amberText, .amberBg) }
    if isYourTurn { return ("● YOUR TURN", .white, .greenText) }
    if inQueue { return s.isDelayed ? ("● DELAYED", .amberText, .amberBg) : ("● LIVE", .white, .liveRed) }
    if s.isArrived { return ("● ARRIVED", .greenText, .greenBg) }
    if s.isDelayed { return ("● DELAYED", .amberText, .amberBg) }
    return ("● ON TIME", .cyanText, .cyanBg)
  }

  var headline: String {
    if done { return "Consultation finished" }
    if s.awaitingPayment { return "Pay the fee to get your token" }
    if isYourTurn { return "It's your turn! Go to \(s.room)" }
    if inQueue { return s.peopleAhead == 1 ? "You're next • 1 patient ahead" : "\(s.peopleAhead) patients ahead of you" }
    if s.isArrived { return "Doctor arrived • \(s.room)" }
    if s.isDelayed { return "Delayed: \(delayText)" }
    let t = s.channelingTime
    return t.isEmpty || t.lowercased().hasPrefix("scheduled") ? "Waiting for the doctor" : "Starts around \(t)"
  }

  var headlineColor: Color {
    if isYourTurn || (s.isArrived && !inQueue) { return .greenText }
    if s.awaitingPayment || s.isDelayed { return .amberText }
    return .brandDark
  }

  /// How far the queue has moved towards this patient's token (0...1)
  var progress: Double? {
    guard inQueue, let mine = Double(s.myToken), mine > 0, let now = Double(s.ongoingToken) else { return nil }
    return min(1, max(0, now / mine))
  }
}

@available(iOS 16.1, *)
struct LiveActivityLockScreenView: View {
  let context: ActivityViewContext<QueueActivityAttributes>

  var body: some View {
    let info = LiveQueueInfo(s: context.state)
    let badge = info.badge
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 1) {
          Text(context.attributes.hospitalName.uppercased())
            .font(.system(size: 10, weight: .heavy)).foregroundColor(.brandDark).lineLimit(1)
          Text(QueueData.formatDoctor(context.attributes.doctorName))
            .font(.system(size: 15, weight: .bold)).foregroundColor(.ink).lineLimit(1)
          Text(context.state.room).font(.system(size: 11, weight: .medium)).foregroundColor(.muted).lineLimit(1)
        }
        Spacer(minLength: 6)
        Badge(text: badge.text, fg: badge.fg, bg: badge.bg)
        RefreshButton()
      }
      if !info.done {
        HStack(spacing: 8) {
          TokenTile(label: "YOUR TOKEN", value: info.myToken, tint: .brand)
          TokenTile(label: "NOW SERVING", value: info.inQueue ? info.ongoing : "--", tint: .liveRed)
        }
        if let p = info.progress {
          ProgressView(value: p).tint(info.isYourTurn ? .greenText : .brand)
        }
      }
      Text(info.headline)
        .font(.system(size: 12, weight: .semibold)).foregroundColor(info.headlineColor).lineLimit(1)
    }
    .padding(14)
  }
}

@available(iOS 16.1, *)
struct QueueLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: QueueActivityAttributes.self) { context in
      LiveActivityLockScreenView(context: context)
        .activityBackgroundTint(Color.white)
        .activitySystemActionForegroundColor(Color.brandDark)
        .widgetURL(URL(string: "carelink://patient-dashboard"))
    } dynamicIsland: { context in
      let info = LiveQueueInfo(s: context.state)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 0) {
            Text("YOUR TOKEN").font(.system(size: 9, weight: .bold)).foregroundColor(.gray)
            Text(info.myToken).font(.system(size: 26, weight: .black, design: .rounded)).foregroundColor(.cyan)
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 0) {
            Text("NOW").font(.system(size: 9, weight: .bold)).foregroundColor(.gray)
            Text(info.inQueue ? info.ongoing : "--")
              .font(.system(size: 26, weight: .black, design: .rounded)).foregroundColor(.red)
          }
          .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(QueueData.formatDoctor(context.attributes.doctorName))
            .font(.system(size: 13, weight: .bold)).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            if let p = info.progress { ProgressView(value: p).tint(info.isYourTurn ? .green : .cyan) }
            Text(info.headline).font(.system(size: 12, weight: .semibold))
              .foregroundColor(info.isYourTurn ? .green : (context.state.isDelayed ? .orange : .white))
              .lineLimit(1)
          }
        }
      } compactLeading: {
        Text(info.myToken).font(.system(size: 14, weight: .heavy, design: .rounded)).foregroundColor(.cyan)
      } compactTrailing: {
        if info.isYourTurn {
          Image(systemName: "figure.walk").foregroundColor(.green)
        } else if info.inQueue {
          Text("\(context.state.peopleAhead) ahead").font(.system(size: 12, weight: .semibold)).foregroundColor(.white)
        } else if context.state.isDelayed {
          Image(systemName: "clock.badge.exclamationmark").foregroundColor(.orange)
        } else {
          Image(systemName: context.state.isArrived ? "checkmark.circle.fill" : "clock")
            .foregroundColor(context.state.isArrived ? .green : .cyan)
        }
      } minimal: {
        if info.inQueue && !info.isYourTurn {
          Text("\(context.state.peopleAhead)").font(.system(size: 13, weight: .heavy)).foregroundColor(.cyan)
        } else {
          Image(systemName: info.isYourTurn ? "figure.walk" : "cross.case.fill")
            .foregroundColor(info.isYourTurn ? .green : .cyan)
        }
      }
      .widgetURL(URL(string: "carelink://patient-dashboard"))
      .keylineTint(.cyan)
    }
  }
}

@main
struct QueueWidgetBundle: WidgetBundle {
  var body: some Widget {
    QueueWidget()
    if #available(iOS 16.1, *) {
      QueueLiveActivity()
    }
  }
}
