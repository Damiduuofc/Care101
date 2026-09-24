package com.damiduuofc.carelinkdoctorapp.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import com.damiduuofc.carelinkdoctorapp.MainActivity
import com.damiduuofc.carelinkdoctorapp.R
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class QueueWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "QueueWidgetProvider"
        const val PREFS_NAME = "care101_widget_prefs"
        const val KEY_WIDGET_DATA = "widget_data_json"
        const val KEY_AUTH_TOKEN = "auth_token"
        const val KEY_API_URL = "api_url"
        const val KEY_PATIENT_ID = "patient_id"

        const val ACTION_REFRESH = "com.damiduuofc.carelinkdoctorapp.widget.ACTION_REFRESH"
        const val ACTION_UPDATE_DATA = "com.damiduuofc.carelinkdoctorapp.widget.ACTION_UPDATE_DATA"

        private val executor = Executors.newSingleThreadExecutor()

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, QueueWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            for (widgetId in allWidgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId)
            }
        }

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_queue)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val rawJson = prefs.getString(KEY_WIDGET_DATA, null)

            // Setup Click to Open App
            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPendingIntent = PendingIntent.getActivity(
                context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root_container, openPendingIntent)
            views.setOnClickPendingIntent(R.id.layout_empty, openPendingIntent)

            // Setup Refresh Click
            val refreshIntent = Intent(context, QueueWidgetProvider::class.java).apply {
                action = ACTION_REFRESH
            }
            val refreshPendingIntent = PendingIntent.getBroadcast(
                context, 1, refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.iv_active_refresh, refreshPendingIntent)
            views.setOnClickPendingIntent(R.id.iv_upcoming_refresh, refreshPendingIntent)
            views.setOnClickPendingIntent(R.id.iv_completed_refresh, refreshPendingIntent)

            if (rawJson.isNullOrEmpty()) {
                showEmptyState(views)
            } else {
                try {
                    val data = JSONObject(rawJson)
                    val state = data.optString("state", "empty")

                    when (state) {
                        "queue" -> bindQueueState(views, data)
                        "upcoming" -> bindUpcomingState(views, data)
                        "completed" -> bindCompletedState(views, data)
                        else -> showEmptyState(views)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing widget data", e)
                    showEmptyState(views)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun showEmptyState(views: RemoteViews) {
            views.setViewVisibility(R.id.layout_empty, View.VISIBLE)
            views.setViewVisibility(R.id.layout_active_queue, View.GONE)
            views.setViewVisibility(R.id.layout_upcoming, View.GONE)
            views.setViewVisibility(R.id.layout_completed, View.GONE)
        }

        private fun bindQueueState(views: RemoteViews, data: JSONObject) {
            views.setViewVisibility(R.id.layout_empty, View.GONE)
            views.setViewVisibility(R.id.layout_active_queue, View.VISIBLE)
            views.setViewVisibility(R.id.layout_upcoming, View.GONE)
            views.setViewVisibility(R.id.layout_completed, View.GONE)

            val hospital = data.optString("hospitalName", "SUWASEWANA HOSPITAL")
            val room = data.optString("room", "Room TBA")
            val doctor = data.optString("doctorName", "Doctor")
            val myToken = data.optString("myToken", "--")
            val ongoingToken = data.optString("ongoingToken", "--")
            val peopleAhead = data.optInt("peopleAhead", 0)
            val estWait = data.optInt("estimatedWait", 0)
            val isDelayed = data.optBoolean("isDelayed", false)
            val delayMsg = data.optString("delayMessage", "")

            views.setTextViewText(R.id.tv_queue_hospital_name, hospital)
            views.setTextViewText(R.id.tv_queue_room_name, room)
            views.setTextViewText(R.id.tv_queue_doctor_name, doctor)
            views.setTextViewText(R.id.tv_queue_my_token, "#$myToken")
            views.setTextViewText(R.id.tv_queue_ongoing_token, "#$ongoingToken")

            var waitStatus = if (peopleAhead > 0) {
                "$peopleAhead Ahead • ~$estWait mins wait"
            } else {
                "Your turn is next / ongoing"
            }

            if (isDelayed && delayMsg.isNotEmpty()) {
                waitStatus += " • $delayMsg"
            }

            views.setTextViewText(R.id.tv_queue_wait_status, waitStatus)
        }

        private fun bindUpcomingState(views: RemoteViews, data: JSONObject) {
            views.setViewVisibility(R.id.layout_empty, View.GONE)
            views.setViewVisibility(R.id.layout_active_queue, View.GONE)
            views.setViewVisibility(R.id.layout_upcoming, View.VISIBLE)
            views.setViewVisibility(R.id.layout_completed, View.GONE)

            val doctor = data.optString("doctorName", "Doctor")
            val myToken = data.optString("myToken", "--")
            val hospital = data.optString("hospitalName", "Suwasewana Hospital")
            val room = data.optString("room", "Room TBA")
            val formattedDate = data.optString("formattedDate", "Today")
            val time = data.optString("channelingTime", "")
            val isDelayed = data.optBoolean("isDelayed", false)
            val delayMsg = data.optString("delayMessage", "Doctor On Time")

            views.setTextViewText(R.id.tv_upcoming_doctor_name, doctor)
            views.setTextViewText(R.id.tv_upcoming_token, "Token #$myToken")
            views.setTextViewText(R.id.tv_upcoming_hospital_room, "$hospital • $room")

            val timeDisplay = if (time.isNotEmpty()) "Scheduled: $formattedDate • $time" else "Scheduled: $formattedDate"
            views.setTextViewText(R.id.tv_upcoming_datetime, timeDisplay)

            if (isDelayed) {
                views.setImageViewResource(R.id.iv_upcoming_delay_icon, R.drawable.ic_warning)
                views.setTextViewText(R.id.tv_upcoming_delay_text, delayMsg)
                views.setTextColor(R.id.tv_upcoming_delay_text, Color.parseColor("#B45309"))
            } else {
                views.setImageViewResource(R.id.iv_upcoming_delay_icon, R.drawable.ic_check)
                views.setTextViewText(R.id.tv_upcoming_delay_text, if (delayMsg.isNotEmpty()) delayMsg else "Doctor On Time")
                views.setTextColor(R.id.tv_upcoming_delay_text, Color.parseColor("#15803D"))
            }
        }

        private fun bindCompletedState(views: RemoteViews, data: JSONObject) {
            val hasUpcoming = data.optBoolean("hasUpcoming", false)
            if (!hasUpcoming) {
                showEmptyState(views)
                return
            }

            views.setViewVisibility(R.id.layout_empty, View.GONE)
            views.setViewVisibility(R.id.layout_active_queue, View.GONE)
            views.setViewVisibility(R.id.layout_upcoming, View.GONE)
            views.setViewVisibility(R.id.layout_completed, View.VISIBLE)

            val nextDoctor = data.optString("nextDoctorName", "Doctor")
            val nextToken = data.optString("nextToken", "--")
            val nextHospital = data.optString("nextHospitalName", "Suwasewana Hospital")
            val nextRoom = data.optString("nextRoom", "Room TBA")
            val nextDate = data.optString("nextDate", "")

            views.setTextViewText(R.id.tv_completed_next_doctor, nextDoctor)
            views.setTextViewText(R.id.tv_completed_next_token, "Token #$nextToken")
            views.setTextViewText(R.id.tv_completed_next_hospital_room, "$nextHospital • $nextRoom")
            views.setTextViewText(R.id.tv_completed_next_date, "Date: $nextDate")
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        // Background refresh from server if possible
        fetchRemoteData(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_REFRESH -> {
                fetchRemoteData(context)
            }
            ACTION_UPDATE_DATA -> {
                updateAllWidgets(context)
            }
        }
    }

    private fun fetchRemoteData(context: Context) {
        executor.execute {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val apiUrl = prefs.getString(KEY_API_URL, null)
            val token = prefs.getString(KEY_AUTH_TOKEN, null)

            if (apiUrl.isNullOrEmpty() || token.isNullOrEmpty()) {
                Log.d(TAG, "Cannot refresh widget: missing apiUrl or token")
                return@execute
            }

            try {
                val cleanUrl = if (apiUrl.endsWith("/")) apiUrl.dropLast(1) else apiUrl
                val targetUrl = "$cleanUrl/appointments/widget-status"
                val url = URL(targetUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("ngrok-skip-browser-warning", "true")
                conn.connectTimeout = 8000
                conn.readTimeout = 8000

                val responseCode = conn.responseCode
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val reader = BufferedReader(InputStreamReader(conn.inputStream))
                    val sb = StringBuilder()
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        sb.append(line)
                    }
                    reader.close()

                    val responseJson = sb.toString()
                    Log.d(TAG, "Widget Remote Response: $responseJson")

                    // Save and refresh
                    prefs.edit().putString(KEY_WIDGET_DATA, responseJson).apply()
                    Handler(Looper.getMainLooper()).post {
                        updateAllWidgets(context)
                    }
                } else {
                    Log.w(TAG, "Failed to fetch widget data: HTTP $responseCode")
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Network error updating widget", e)
            }
        }
    }
}
