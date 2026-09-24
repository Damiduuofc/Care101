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
            prefs.edit().putString(QueueWidgetProvider.KEY_WIDGET_DATA, dataJson).apply()
            QueueWidgetProvider.updateAllWidgets(reactContext)
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
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_SET_AUTH", e.message, e)
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
            QueueWidgetProvider.updateAllWidgets(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_CLEAR_WIDGET", e.message, e)
        }
    }

    @ReactMethod
    fun refreshWidget(promise: Promise) {
        try {
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
