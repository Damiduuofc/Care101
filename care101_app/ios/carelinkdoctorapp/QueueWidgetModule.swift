import Foundation
import UserNotifications
import WidgetKit
import React

/// iOS counterpart of the Android QueueWidgetModule.
/// Stores the widget payload + auth context in the shared App Group so the
/// QueueWidget extension can render it and refresh itself from the backend.
@objc(QueueWidgetModule)
class QueueWidgetModule: NSObject, UNUserNotificationCenterDelegate {

  static let appGroup = "group.com.damiduuofc.carelinkdoctorapp"
  static let keyWidgetData = "widget_data_json"
  static let keySyncedAt = "widget_synced_at_ms"
  static let keyAuthToken = "auth_token"
  static let keyApiUrl = "api_url"
  static let keyPatientId = "patient_id"
  static let widgetKind = "QueueWidget"

  private var defaults: UserDefaults? { UserDefaults(suiteName: QueueWidgetModule.appGroup) }

  override init() {
    super.init()
    // Show banners even while the app is in the foreground (matches Android heads-up behaviour)
    UNUserNotificationCenter.current().delegate = self
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: - Bridge methods

  @objc(updateWidgetData:resolver:rejecter:)
  func updateWidgetData(_ dataJson: String,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let defaults = defaults else {
      reject("ERROR_UPDATE_WIDGET", "App Group unavailable", nil); return
    }
    let prevJson = defaults.string(forKey: QueueWidgetModule.keyWidgetData)
    defaults.set(dataJson, forKey: QueueWidgetModule.keyWidgetData)
    defaults.set(Date().timeIntervalSince1970 * 1000, forKey: QueueWidgetModule.keySyncedAt)
    notifyStateTransition(prevJson: prevJson, newJson: dataJson)
    reloadWidgets()
    resolve(true)
  }

  @objc(setAuthContext:apiUrl:patientId:resolver:rejecter:)
  func setAuthContext(_ token: String, apiUrl: String, patientId: String,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let defaults = defaults else {
      reject("ERROR_SET_AUTH", "App Group unavailable", nil); return
    }
    defaults.set(token, forKey: QueueWidgetModule.keyAuthToken)
    defaults.set(apiUrl, forKey: QueueWidgetModule.keyApiUrl)
    defaults.set(patientId, forKey: QueueWidgetModule.keyPatientId)
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
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
    [QueueWidgetModule.keyWidgetData, QueueWidgetModule.keySyncedAt,
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
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadTimelines(ofKind: QueueWidgetModule.widgetKind)
    }
  }

  private func postNotification(id: String, title: String, message: String) {
    guard !message.isEmpty else { return }
    let content = UNMutableNotificationContent()
    content.title = title.isEmpty ? "CareLink 101 Alert" : title
    content.body = message
    content.sound = .default
    let request = UNNotificationRequest(identifier: id.isEmpty ? UUID().uuidString : id,
                                        content: content, trigger: nil)
    UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
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
  private func notifyStateTransition(prevJson: String?, newJson: String) {
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

  // MARK: - UNUserNotificationCenterDelegate

  func userNotificationCenter(_ center: UNUserNotificationCenter,
                              willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .sound])
    } else {
      completionHandler([.alert, .sound])
    }
  }
}
