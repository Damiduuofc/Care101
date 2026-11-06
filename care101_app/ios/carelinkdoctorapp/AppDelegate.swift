internal import Expo
import React
import UserNotifications
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // Queue alerts, widget refreshes and Live Activity updates arrive as Apple push
    // notifications, because iOS suspends the app's live socket in the background.
    UNUserNotificationCenter.current().delegate = PushNotificationDelegate.shared
    application.registerForRemoteNotifications()
    if #available(iOS 16.2, *) { LiveActivityManager.start() }
    // Periodic queue refresh while the app is closed (no paid developer account needed)
    QueueRefresher.register()

    // The window and React Native root are created in SceneDelegate: apps built with the
    // iOS 27 SDK must adopt the UIScene lifecycle or UIKit terminates them at launch.
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - Apple push

  public override func application(_ application: UIApplication,
                                   didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    PushRegistrar.didRegister(deviceToken: deviceToken)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  public override func application(_ application: UIApplication,
                                   didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NSLog("APNs registration failed: \(error.localizedDescription)")
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  // Background push carrying the latest widget-status payload
  public override func application(_ application: UIApplication,
                                   didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                                   fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    completionHandler(RemotePushHandler.handle(userInfo) ? .newData : .noData)
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let config = UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
    config.delegateClass = SceneDelegate.self
    return config
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? { UIApplication.shared.delegate as? AppDelegate }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene, let appDelegate = appDelegate else { return }

    // Cold-start deep link (e.g. tapping the home screen widget) for Linking.getInitialURL()
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  // Ask iOS to wake us for a queue refresh while we're in the background
  func sceneDidEnterBackground(_ scene: UIScene) {
    QueueRefresher.schedule()
  }

  // Coming back to the app: catch up right away (the JS socket also resyncs)
  func sceneWillEnterForeground(_ scene: UIScene) {
    Task { await QueueRefresher.refresh() }
  }

  // Warm deep links: with scenes, UIKit delivers these here instead of the app delegate.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = appDelegate else { return }
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
      options[.sourceApplication] = context.options.sourceApplication
      options[.annotation] = context.options.annotation
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity) { _ in }
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
