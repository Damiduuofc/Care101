package com.damiduuofc.carelinkdoctorapp.widget

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class QueueWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "QueueWidgetModule"

    @ReactMethod
    fun updateWidgetData(dataJson: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            val prevJson = prefs.getString(QueueWidgetProvider.KEY_WIDGET_DATA, null)
            prefs.edit().putString(QueueWidgetProvider.KEY_WIDGET_DATA, dataJson).apply()
            QueueWidgetProvider.checkAndNotifyStateTransition(reactContext, prevJson, dataJson)
            QueueWidgetProvider.updateAllWidgets(reactContext)
            QueueForegroundService.refreshNotificationAndRoom(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_UPDATE_WIDGET", e.message, e)
        }
    }

    @ReactMethod
    fun setAuthContext(token: String, apiUrl: String, patientId: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(QueueWidgetProvider.KEY_AUTH_TOKEN, token)
                .putString(QueueWidgetProvider.KEY_API_URL, apiUrl)
                .putString(QueueWidgetProvider.KEY_PATIENT_ID, patientId)
                .apply()
            QueueWidgetProvider.ensureNotificationChannel(reactContext)
            QueueForegroundService.startOrUpdate(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_SET_AUTH", e.message, e)
        }
    }

    @ReactMethod
    fun showLocalNotification(id: String, title: String, message: String, promise: Promise) {
        try {
            QueueWidgetProvider.showSystemNotification(reactContext, id, title, message)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_SHOW_NOTIFICATION", e.message, e)
        }
    }

    @ReactMethod
    fun clearWidgetData(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .remove(QueueWidgetProvider.KEY_WIDGET_DATA)
                .remove(QueueWidgetProvider.KEY_AUTH_TOKEN)
                .remove(QueueWidgetProvider.KEY_PATIENT_ID)
                .apply()
            QueueForegroundService.stop(reactContext)
            QueueWidgetProvider.updateAllWidgets(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_CLEAR_WIDGET", e.message, e)
        }
    }

    @ReactMethod
    fun refreshWidget(promise: Promise) {
        try {
            QueueForegroundService.startOrUpdate(reactContext)
            val intent = Intent(reactContext, QueueWidgetProvider::class.java).apply {
                action = QueueWidgetProvider.ACTION_REFRESH
            }
            reactContext.sendBroadcast(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_REFRESH_WIDGET", e.message, e)
        }
    }
}
