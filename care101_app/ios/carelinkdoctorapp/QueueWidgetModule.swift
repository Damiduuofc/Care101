import Foundation
import UIKit
import UserNotifications
import WidgetKit
import ActivityKit
import AppIntents
import BackgroundTasks
import React

/// iOS counterpart of the Android QueueWidgetModule.
/// Stores the widget payload + auth context in the shared App Group so the
/// QueueWidget extension can render it and refresh itself from the backend.
@objc(QueueWidgetModule)
class QueueWidgetModule: NSObject {

  static let appGroup = "group.com.damiduuofc.carelinkdoctorapp"
  static let keyWidgetData = "widget_data_json"
  static let keySyncedAt = "widget_synced_at_ms"
  static let keyAuthToken = "auth_token"
  static let keyApiUrl = "api_url"
  static let keyPatientId = "patient_id"
  static let keyLastNotified = "widget_last_notified_json"
  static let widgetKind = "QueueWidget"

  private var defaults: UserDefaults? { UserDefaults(suiteName: QueueWidgetModule.appGroup) }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: - Bridge methods

  @objc(updateWidgetData:resolver:rejecter:)
  func updateWidgetData(_ dataJson: String,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard defaults != nil else {
      reject("ERROR_UPDATE_WIDGET", "App Group unavailable", nil); return
    }
    QueueWidgetModule.storeWidgetPayload(dataJson)
    resolve(true)
  }

  @objc(setAuthContext:apiUrl:patientId:resolver:rejecter:)
  func setAuthContext(_ token: String, apiUrl: String, patientId: String,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let defaults = defaults else {
      reject("ERROR_SET_AUTH", "App Group unavailable", nil); return
    }
    let accountChanged = defaults.string(forKey: QueueWidgetModule.keyAuthToken) != token
    defaults.set(token, forKey: QueueWidgetModule.keyAuthToken)
    defaults.set(apiUrl, forKey: QueueWidgetModule.keyApiUrl)
    defaults.set(patientId, forKey: QueueWidgetModule.keyPatientId)
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    // Link this iPhone's push token to the signed-in patient (only when it changed).
    // Needs a paid Apple Developer account; without one registration just fails quietly.
    if accountChanged { PushRegistrar.upload() }
    DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
    QueueRefresher.schedule()
    resolve(true)
  }

  @objc(showLocalNotification:title:message:resolver:rejecter:)
  func showLocalNotification(_ id: String, title: String, message: String,
                             resolver resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
    postNotification(id: id, title: title, message: message)
    resolve(true)
  }

  @objc(clearWidgetData:rejecter:)
  func clearWidgetData(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    let d = defaults
    PushRegistrar.unregister()
    if #available(iOS 16.2, *) { LiveActivityManager.endAll() }
    [QueueWidgetModule.keyWidgetData, QueueWidgetModule.keySyncedAt, QueueWidgetModule.keyLastNotified,
     QueueWidgetModule.keyAuthToken, QueueWidgetModule.keyPatientId].forEach { d?.removeObject(forKey: $0) }
    reloadWidgets()
    resolve(true)
  }

  @objc(refreshWidget:rejecter:)
  func refreshWidget(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    reloadWidgets()
    resolve(true)
  }

  // MARK: - Helpers

  private func reloadWidgets() {
    WidgetCenter.shared.reloadTimelines(ofKind: QueueWidgetModule.widgetKind)
  }

  /// Saves a widget-status payload for the widget, reloads it, mirrors it onto the
  /// Live Activity and posts Android-style alerts for what changed. Used by the JS bridge,
  /// background refresh, the refresh button and (paid accounts) server pushes.
  static func storeWidgetPayload(_ json: String) {
    guard let defaults = UserDefaults(suiteName: appGroup) else { return }
    // Compare with what we last alerted on, not the widget's copy: the widget extension
    // refreshes the same key itself, which would hide changes from us.
    let prevJson = defaults.string(forKey: keyLastNotified) ?? defaults.string(forKey: keyWidgetData)
    QueueWidgetModule().notifyStateTransition(prevJson: prevJson, newJson: json)
    defaults.set(json, forKey: keyLastNotified)
    defaults.set(json, forKey: keyWidgetData)
    defaults.set(Date().timeIntervalSince1970 * 1000, forKey: keySyncedAt)
    WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
    if #available(iOS 16.2, *),
       let data = json.data(using: .utf8),
       let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
      LiveActivityManager.sync(with: obj)
    }
  }

  private func postNotification(id: String, title: String, message: String) {
    guard !message.isEmpty else { return }
    // Once the server sends these as push notifications, local copies would be duplicates
    if PushRegistrar.serverPushEnabled { return }
    // iOS shows the banner and plays the sound again whenever a request is re-added, even with
    // the same identifier, and the same alert reaches here from several places (socket events,
    // notification list refreshes, widget-status transitions). Post each alert only once.
    guard QueueWidgetModule.claimAlert(id: id, title: title, message: message) else { return }
    let content = UNMutableNotificationContent()
    content.title = title.isEmpty ? "CareLink 101 Alert" : title
    content.body = message
    content.sound = .default
    let request = UNNotificationRequest(identifier: id.isEmpty ? UUID().uuidString : id,
                                        content: content, trigger: nil)
    UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
  }

  static let keyPostedAlerts = "posted_alert_keys"
  private static let alertIdMemory: TimeInterval = 24 * 60 * 60   // same id: once a day
  private static let alertTextMemory: TimeInterval = 30 * 60      // same text under another id
  private static let alertLock = NSLock()

  /// Records the alert and returns true when it has not been posted recently: the same id
  /// within a day, or the same title and text within 30 minutes (JS and native code post
  /// the same alert under different ids).
  static func claimAlert(id: String, title: String, message: String, now: Date = Date()) -> Bool {
    alertLock.lock(); defer { alertLock.unlock() }
    guard let d = UserDefaults(suiteName: appGroup) else { return true }
    let t = now.timeIntervalSince1970
    var seen = (d.dictionary(forKey: keyPostedAlerts) as? [String: Double] ?? [:])
      .filter { t - $0.value < alertIdMemory }
    let idKey = id.isEmpty ? nil : "id:\(id)"
    let textKey = "text:\(title)\n\(message)"
    if let idKey, seen[idKey] != nil { return false }
    if let at = seen[textKey], t - at < alertTextMemory { return false }
    if let idKey { seen[idKey] = t }
    seen[textKey] = t
    d.set(seen, forKey: keyPostedAlerts)
    return true
  }

  private func parse(_ json: String?) -> [String: Any]? {
    guard let data = json?.data(using: .utf8) else { return nil }
    return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
  }

  private func str(_ d: [String: Any], _ k: String, _ fallback: String = "") -> String {
    guard let v = d[k], !(v is NSNull) else { return fallback }
    return "\(v)"
  }

  private func int(_ d: [String: Any], _ k: String, _ fallback: Int = 0) -> Int {
    if let n = d[k] as? NSNumber { return n.intValue }
    if let s = d[k] as? String, let n = Int(s) { return n }
    return fallback
  }

  private func bool(_ d: [String: Any], _ k: String) -> Bool { (d[k] as? NSNumber)?.boolValue ?? false }

  /// Mirrors QueueWidgetProvider.checkAndNotifyStateTransition on Android.
  func notifyStateTransition(prevJson: String?, newJson: String) {
    guard let prev = parse(prevJson), let curr = parse(newJson) else { return }
    let prevState = str(prev, "state", "empty")
    let currState = str(curr, "state", "empty")
    if currState == "empty" { return }

    let doctor = str(curr, "doctorName", "Doctor")
    let room = str(curr, "room", "Room TBA")
    let myToken = str(curr, "myToken", "--")
    let currOngoing = int(curr, "ongoingToken")
    let prevOngoing = int(prev, "ongoingToken")
    let status = str(curr, "channelingStatus")
    let peopleAhead = int(curr, "peopleAhead", -1)
    let awaitingPayment = bool(curr, "awaitingPayment")
    let minute = Int(Date().timeIntervalSince1970 / 60)

    if bool(curr, "isArrived") && !bool(prev, "isArrived") {
      postNotification(id: "arrived_\(doctor)_\(room)_\(minute)", title: "Doctor Arrived at Clinic",
                       message: awaitingPayment
                         ? "\(doctor) has arrived at \(room). Please pay the fee to get your queue token."
                         : "\(doctor) has arrived at \(room). Your Token is #\(myToken).")
    }
    if bool(curr, "isDelayed") && (!bool(prev, "isDelayed") || str(prev, "channelingStatus") != status) {
      postNotification(id: "delay_\(doctor)_\(status)", title: "Doctor Delay Notice",
                       message: "\(doctor) is currently \(status) (\(room)).")
    }
    if currState == "queue" && prevState != "queue" {
      postNotification(id: "session_start_\(doctor)_\(currOngoing)", title: "Channeling Session Started",
                       message: "\(doctor) has started seeing patients in \(room). Ongoing Token: #\(currOngoing) (Your Token: #\(myToken)).")
    }
    if currState == "queue" && currOngoing != prevOngoing && currOngoing > 0 {
      switch peopleAhead {
      case 0:
        postNotification(id: "turn_now_\(doctor)_\(myToken)", title: "It's Your Turn Now! (#\(myToken))",
                         message: "Token #\(myToken) is now being called by \(doctor) in \(room). Please enter now.")
      case 1:
        postNotification(id: "turn_next_\(doctor)_\(myToken)_\(currOngoing)", title: "You Are Next in Queue!",
                         message: "1 patient ahead of you for \(doctor) (\(room)). Ongoing Token: #\(currOngoing).")
      case 3:
        postNotification(id: "turn_3_\(doctor)_\(myToken)_\(currOngoing)", title: "Queue Alert: 3 Patients Ahead",
                         message: "Only 3 patients ahead of your Token #\(myToken) for \(doctor) (\(room)).")
      default: break
      }
    }
  }
}

// MARK: - Background refresh (works without a paid developer account)

/// Without Apple push, iOS only lets the app run in the background when it schedules it.
/// This fetches /appointments/widget-status natively and feeds it to the widget, the Live
/// Activity and the local alerts. iOS picks the actual times (usually every 15-60 min,
/// more often for apps the patient opens a lot).
enum QueueRefresher {
  static let taskId = "com.damiduuofc.carelinkdoctorapp.queue-refresh"

  /// Must run before application(_:didFinishLaunchingWithOptions:) returns.
  static func register() {
    BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
      guard let task = task as? BGAppRefreshTask else { return }
      schedule()
      let work = Task {
        let ok = await refresh()
        task.setTaskCompleted(success: ok)
      }
      task.expirationHandler = { work.cancel() }
    }
  }

  static func schedule() {
    let d = UserDefaults(suiteName: QueueWidgetModule.appGroup)
    guard let auth = d?.string(forKey: QueueWidgetModule.keyAuthToken), !auth.isEmpty else { return }
    let live = (d?.string(forKey: QueueWidgetModule.keyWidgetData) ?? "").contains("\"state\":\"queue\"")
    let request = BGAppRefreshTaskRequest(identifier: taskId)
    request.earliestBeginDate = Date(timeIntervalSinceNow: live ? 5 * 60 : 15 * 60)
    BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskId)
    try? BGTaskScheduler.shared.submit(request)
  }

  /// Fetch the latest queue status and apply it everywhere. Returns false on failure.
  @discardableResult
  static func refresh() async -> Bool {
    guard let d = UserDefaults(suiteName: QueueWidgetModule.appGroup),
          let auth = d.string(forKey: QueueWidgetModule.keyAuthToken), !auth.isEmpty,
          let api = d.string(forKey: QueueWidgetModule.keyApiUrl), !api.isEmpty else { return false }
    let base = api.hasSuffix("/") ? String(api.dropLast()) : api
    guard let url = URL(string: "\(base)/appointments/widget-status") else { return false }
    var req = URLRequest(url: url, timeoutInterval: 15)
    req.setValue("Bearer \(auth)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("true", forHTTPHeaderField: "ngrok-skip-browser-warning")
    guard let (data, resp) = try? await URLSession.shared.data(for: req),
          (resp as? HTTPURLResponse)?.statusCode == 200,
          let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], obj["state"] != nil,
          let json = String(data: data, encoding: .utf8) else { return false }
    QueueWidgetModule.storeWidgetPayload(json)
    return true
  }
}

/// The refresh button on the widget and the Lock Screen Live Activity. As a
/// LiveActivityIntent iOS runs it inside the app (in the background), so one tap updates
/// the widget, the Live Activity and posts alerts without opening the app.
/// The widget extension has a same-named copy; keep the two in sync.
@available(iOS 17.0, *)
struct RefreshQueueIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Refresh Queue"
  func perform() async throws -> some IntentResult {
    await QueueRefresher.refresh()
    return .result()
  }
}

// MARK: - Apple push registration

/// Sends this iPhone's APNs tokens to the backend (POST /push/ios/...), using the auth token
/// and API URL the app stored in the App Group. Runs natively so it also works when the
/// system wakes the app in the background.
enum PushRegistrar {
  static let keyDeviceToken = "apns_device_token"
  static let keyServerPush = "server_push_enabled"
  static let keyPushToStart = "la_push_to_start_token"
  static let keyActivityTokens = "la_activity_tokens" // [appointmentId: token]

  private static var defaults: UserDefaults? { UserDefaults(suiteName: QueueWidgetModule.appGroup) }

  static var serverPushEnabled: Bool {
    let d = defaults
    return (d?.bool(forKey: keyServerPush) ?? false) && d?.string(forKey: keyDeviceToken) != nil
  }

  private static var environment: String {
#if DEBUG
    return "sandbox"
#else
    return "production"
#endif
  }

  static func hex(_ data: Data) -> String { data.map { String(format: "%02x", $0) }.joined() }

  static func didRegister(deviceToken: Data) {
    let token = hex(deviceToken)
    let changed = defaults?.string(forKey: keyDeviceToken) != token
    defaults?.set(token, forKey: keyDeviceToken)
    if changed || !(defaults?.bool(forKey: keyServerPush) ?? false) { upload() }
  }

  /// Registers the device for the signed-in user, then re-sends any Live Activity tokens.
  static func upload() {
    guard let token = defaults?.string(forKey: keyDeviceToken) else { return }
    request("push/ios/register", method: "POST", body: [
      "deviceToken": token,
      "environment": environment,
      "bundleId": Bundle.main.bundleIdentifier ?? "",
    ]) { obj in
      guard let obj = obj else { return }
      defaults?.set((obj["enabled"] as? NSNumber)?.boolValue ?? false, forKey: keyServerPush)
      if let pts = defaults?.string(forKey: keyPushToStart) { sendPushToStart(pts) }
      for (appt, t) in (defaults?.dictionary(forKey: keyActivityTokens) as? [String: String]) ?? [:] {
        sendActivity(appointmentId: appt, token: t, ended: false)
      }
    }
  }

  /// Logout: stop pushes for the previous account (must run before the auth token is removed).
  static func unregister() {
    if let token = defaults?.string(forKey: keyDeviceToken) {
      request("push/ios/register", method: "DELETE", body: ["deviceToken": token]) { _ in }
    }
    defaults?.set(false, forKey: keyServerPush)
    defaults?.removeObject(forKey: keyActivityTokens)
  }

  static func reportPushToStart(_ token: String) {
    defaults?.set(token, forKey: keyPushToStart)
    sendPushToStart(token)
  }

  static func reportActivity(appointmentId: String, token: String?, ended: Bool) {
    var map = (defaults?.dictionary(forKey: keyActivityTokens) as? [String: String]) ?? [:]
    if ended { map.removeValue(forKey: appointmentId) } else if let token = token { map[appointmentId] = token }
    defaults?.set(map, forKey: keyActivityTokens)
    sendActivity(appointmentId: appointmentId, token: token, ended: ended)
  }

  private static func sendPushToStart(_ token: String) {
    guard let device = defaults?.string(forKey: keyDeviceToken) else { return }
    request("push/ios/push-to-start", method: "POST", body: ["deviceToken": device, "token": token]) { _ in }
  }

  private static func sendActivity(appointmentId: String, token: String?, ended: Bool) {
    guard let device = defaults?.string(forKey: keyDeviceToken) else { return }
    var body: [String: Any] = ["deviceToken": device, "appointmentId": appointmentId, "ended": ended]
    if let token = token { body["token"] = token }
    request("push/ios/live-activity", method: "POST", body: body) { _ in }
  }

  private static func request(_ path: String, method: String, body: [String: Any],
                              completion: @escaping ([String: Any]?) -> Void) {
    guard let d = defaults,
          let auth = d.string(forKey: QueueWidgetModule.keyAuthToken), !auth.isEmpty,
          let api = d.string(forKey: QueueWidgetModule.keyApiUrl), !api.isEmpty else { return completion(nil) }
    let base = api.hasSuffix("/") ? String(api.dropLast()) : api
    guard let url = URL(string: "\(base)/\(path)") else { return completion(nil) }
    var req = URLRequest(url: url, timeoutInterval: 15)
    req.httpMethod = method
    req.setValue("Bearer \(auth)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("true", forHTTPHeaderField: "ngrok-skip-browser-warning")
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    URLSession.shared.dataTask(with: req) { data, resp, _ in
      guard (resp as? HTTPURLResponse)?.statusCode == 200, let data = data else { return completion(nil) }
      completion((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])
    }.resume()
  }
}

// MARK: - Background push from the server

enum RemotePushHandler {
  /// `{ aps: { content-available: 1 }, widget: {...widget-status payload} }`
  static func handle(_ userInfo: [AnyHashable: Any]) -> Bool {
    guard let widget = userInfo["widget"] as? [String: Any], widget["state"] != nil,
          let data = try? JSONSerialization.data(withJSONObject: widget),
          let json = String(data: data, encoding: .utf8) else { return false }
    QueueWidgetModule.storeWidgetPayload(json)
    return true
  }
}

// MARK: - Live Activity (Lock Screen + Dynamic Island)

/// Keep identical to the copy in QueueWidget/QueueWidget.swift: iOS matches the two by name
/// and the server's push payload (utils/iosPush.js) must decode into ContentState.
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
extension QueueActivityAttributes.ContentState {
  init(widget d: [String: Any]) {
    func s(_ k: String, _ f: String) -> String {
      guard let v = d[k], !(v is NSNull) else { return f }
      let out = "\(v)"
      return out.isEmpty ? f : out
    }
    func b(_ k: String) -> Bool { (d[k] as? NSNumber)?.boolValue ?? false }
    state = s("state", "upcoming")
    myToken = s("myToken", "--")
    ongoingToken = s("ongoingToken", "0")
    peopleAhead = (d["peopleAhead"] as? NSNumber)?.intValue ?? Int(s("peopleAhead", "0")) ?? 0
    room = s("room", "Room TBA")
    channelingStatus = s("channelingStatus", "On Time")
    channelingTime = s("channelingTime", "")
    isArrived = b("isArrived")
    isDelayed = b("isDelayed")
    awaitingPayment = b("awaitingPayment")
  }

  static var completed: Self { Self(widget: ["state": "completed"]) }
}

@available(iOS 16.2, *)
enum LiveActivityManager {
  typealias QueueActivity = Activity<QueueActivityAttributes>
  private static let keyDismissed = "la_dismissed_appointments"
  private static let lock = NSLock()
  private static var observed = Set<String>()
  private static var started = false
  // Syncs run one after another so overlapping updates can't start duplicate activities
  private static var chain: Task<Void, Never>?

  private static var defaults: UserDefaults? { UserDefaults(suiteName: QueueWidgetModule.appGroup) }

  /// Called once at launch: track existing activities (including ones the server started
  /// remotely) and report their push tokens to the backend.
  static func start() {
    lock.lock()
    let first = !started
    started = true
    lock.unlock()
    guard first else { return }
    QueueActivity.activities.forEach(observe)
    Task { for await activity in QueueActivity.activityUpdates { observe(activity) } }
    if #available(iOS 17.2, *) {
      Task {
        for await data in QueueActivity.pushToStartTokenUpdates {
          PushRegistrar.reportPushToStart(PushRegistrar.hex(data))
        }
      }
    }
  }

  /// Mirror a widget-status payload: update the matching activity, end stale ones and start
  /// one for today's appointment (starting only works while the app is in the foreground).
  static func sync(with payload: [String: Any]) {
    let state = payload["state"] as? String ?? "empty"
    let appointmentId = payload["appointmentId"].map { "\($0)" } ?? ""
    let live = (state == "queue" || state == "upcoming") && !appointmentId.isEmpty
    let content = QueueActivityAttributes.ContentState(widget: payload)

    lock.lock()
    let previous = chain
    chain = Task {
      await previous?.value
      await apply(live: live, appointmentId: appointmentId, content: content, payload: payload)
    }
    lock.unlock()
  }

  private static func apply(live: Bool, appointmentId: String,
                            content: QueueActivityAttributes.ContentState,
                            payload: [String: Any]) async {
    do {
      var hasCurrent = false
      for activity in QueueActivity.activities {
        if live && activity.attributes.appointmentId == appointmentId {
          hasCurrent = true
          await activity.update(ActivityContent(state: content, staleDate: Date().addingTimeInterval(3 * 3600)))
        } else {
          await end(activity)
        }
      }
      guard live, !hasCurrent, !dismissedAppointments.contains(appointmentId),
            ActivityAuthorizationInfo().areActivitiesEnabled else { return }
      let attributes = QueueActivityAttributes(
        appointmentId: appointmentId,
        doctorName: (payload["doctorName"] as? String) ?? "Doctor",
        hospitalName: (payload["hospitalName"] as? String) ?? "SUWASEWANA HOSPITAL")
      do {
        let activity = try QueueActivity.request(
          attributes: attributes,
          content: ActivityContent(state: content, staleDate: Date().addingTimeInterval(3 * 3600)),
          // Push updates need Apple push (a paid developer account); otherwise the app
          // updates the activity itself (foreground, background refresh, refresh button).
          pushType: PushRegistrar.serverPushEnabled ? .token : nil)
        observe(activity)
      } catch {
        // Background, Live Activities turned off, or too many running: the widget still works
        NSLog("Live Activity not started: \(error.localizedDescription)")
      }
    }
  }

  static func endAll() {
    Task { for activity in QueueActivity.activities { await end(activity) } }
  }

  private static func end(_ activity: QueueActivity) async {
    await activity.end(ActivityContent(state: .completed, staleDate: nil),
                       dismissalPolicy: .after(Date().addingTimeInterval(15 * 60)))
  }

  private static var dismissedAppointments: Set<String> {
    Set(defaults?.stringArray(forKey: keyDismissed) ?? [])
  }

  private static func observe(_ activity: QueueActivity) {
    lock.lock()
    let isNew = observed.insert(activity.id).inserted
    lock.unlock()
    guard isNew else { return }
    let appointmentId = activity.attributes.appointmentId
    Task {
      for await data in activity.pushTokenUpdates {
        PushRegistrar.reportActivity(appointmentId: appointmentId, token: PushRegistrar.hex(data), ended: false)
      }
    }
    Task {
      for await state in activity.activityStateUpdates where state == .ended || state == .dismissed {
        if state == .dismissed {
          // The patient swiped it away: don't bring it back for this appointment
          var list = defaults?.stringArray(forKey: keyDismissed) ?? []
          list.append(appointmentId)
          defaults?.set(Array(list.suffix(20)), forKey: keyDismissed)
        }
        PushRegistrar.reportActivity(appointmentId: appointmentId, token: nil, ended: true)
        break
      }
    }
  }
}

// MARK: - Notification presentation

final class PushNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
  static let shared = PushNotificationDelegate()

  // Show banners even while the app is open (matches Android heads-up behaviour)
  func userNotificationCenter(_ center: UNUserNotificationCenter,
                              willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .list, .sound])
  }

  // Tapping a queue notification opens the patient dashboard
  func userNotificationCenter(_ center: UNUserNotificationCenter,
                              didReceive response: UNNotificationResponse,
                              withCompletionHandler completionHandler: @escaping () -> Void) {
    if let link = response.notification.request.content.userInfo["url"] as? String,
       let url = URL(string: link) {
      DispatchQueue.main.async { UIApplication.shared.open(url) }
    }
    completionHandler()
  }
}
