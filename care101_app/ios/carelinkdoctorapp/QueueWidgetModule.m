#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(QueueWidgetModule, NSObject)

RCT_EXTERN_METHOD(updateWidgetData:(NSString *)dataJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setAuthContext:(NSString *)token
                  apiUrl:(NSString *)apiUrl
                  patientId:(NSString *)patientId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(showLocalNotification:(NSString *)id
                  title:(NSString *)title
                  message:(NSString *)message
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearWidgetData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(refreshWidget:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
