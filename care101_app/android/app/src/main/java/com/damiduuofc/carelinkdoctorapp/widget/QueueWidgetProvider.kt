package com.damiduuofc.carelinkdoctorapp.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
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
        private val mainHandler = Handler(Looper.getMainLooper())
        private var burstCount = 0
        private var burstRunnable: Runnable? = null

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, QueueWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            for (widgetId in allWidgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId)
            }
            if (allWidgetIds.isNotEmpty()) {
                schedulePeriodicRefresh(context)
            }
        }

        fun schedulePeriodicRefresh(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                val intent = Intent(context, QueueWidgetProvider::class.java).apply {
                    action = ACTION_REFRESH
                }
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    1001,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                // Repeat every 60s while device is awake (RTC does not wake sleeping screen)
                alarmManager.setInexactRepeating(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + 15_000L,
                    60_000L,
                    pendingIntent
                )
            } catch (e: Exception) {
                Log.w(TAG, "Unable to schedule widget alarm", e)
            }
        }

        fun cancelPeriodicRefresh(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                val intent = Intent(context, QueueWidgetProvider::class.java).apply {
                    action = ACTION_REFRESH
                }
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    1001,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarmManager.cancel(pendingIntent)
            } catch (e: Exception) {
                Log.w(TAG, "Unable to cancel widget alarm", e)
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

            val hospital = data.optString("hospitalName", "SUWASEWANA HOSPITAL").uppercase()
            val room = data.optString("room", "Room TBA")
            val doctor = data.optString("doctorName", "Doctor")
            val myToken = data.optString("myToken", "--")
            val ongoingToken = data.optString("ongoingToken", "--")
            val peopleAhead = data.optInt("peopleAhead", 0)
            val isDelayed = data.optBoolean("isDelayed", false)
            val channelingStatus = data.optString("channelingStatus", "")

            views.setTextViewText(R.id.tv_queue_hospital_name, hospital)
            views.setTextViewText(R.id.tv_queue_room_name, room)
            views.setTextViewText(R.id.tv_queue_doctor_name, doctor)
            views.setTextViewText(R.id.tv_queue_my_token, "#$myToken")
            views.setTextViewText(R.id.tv_queue_ongoing_token, "#$ongoingToken")

            if (isDelayed) {
                views.setTextViewText(R.id.tv_queue_live_badge, "● DELAYED")
            } else {
                views.setTextViewText(R.id.tv_queue_live_badge, "● LIVE")
            }

            // No estimated arrival/wait time - only accurate queue count and delay notice
            var waitStatus = when {
                peopleAhead <= 0 -> "Your Turn is Now!"
                peopleAhead == 1 -> "1 Patient Ahead of You"
                else -> "$peopleAhead Patients Ahead of You"
            }

            if (isDelayed && channelingStatus.isNotEmpty() && !channelingStatus.equals("On Time", ignoreCase = true)) {
                waitStatus += " • $channelingStatus"
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
            val channelingStatus = data.optString("channelingStatus", "")
            val delayMsg = data.optString("delayMessage", "")

            views.setTextViewText(R.id.tv_upcoming_doctor_name, doctor)
            views.setTextViewText(R.id.tv_upcoming_token, "Token #$myToken")

            val scheduleSuffix = if (time.isNotEmpty() && !time.equals("Scheduled Today", ignoreCase = true)) {
                "$formattedDate ($time)"
            } else {
                formattedDate
            }
            views.setTextViewText(R.id.tv_upcoming_hospital_room, "$hospital • $room • $scheduleSuffix")

            if (isDelayed) {
                views.setInt(R.id.layout_upcoming_delay_banner, "setBackgroundResource", R.drawable.badge_delayed)
                views.setImageViewResource(R.id.iv_upcoming_delay_icon, R.drawable.ic_warning)
                views.setTextViewText(R.id.tv_upcoming_delay_title, "DOCTOR DELAY NOTICE")
                views.setTextColor(R.id.tv_upcoming_delay_title, Color.parseColor("#92400E"))

                val cleanDelayText = when {
                    channelingStatus.isNotEmpty() && !channelingStatus.equals("On Time", ignoreCase = true) -> channelingStatus
                    delayMsg.startsWith("Doctor Delayed:", ignoreCase = true) -> delayMsg.substringAfter(":").trim()
                    delayMsg.isNotEmpty() -> delayMsg
                    else -> "Session start is delayed"
                }
                views.setTextViewText(R.id.tv_upcoming_delay_text, cleanDelayText)
                views.setTextColor(R.id.tv_upcoming_delay_text, Color.parseColor("#B45309"))
            } else {
                views.setInt(R.id.layout_upcoming_delay_banner, "setBackgroundResource", R.drawable.badge_ontime)
                views.setImageViewResource(R.id.iv_upcoming_delay_icon, R.drawable.ic_check)
                views.setTextViewText(R.id.tv_upcoming_delay_title, "DOCTOR ON SCHEDULE")
                views.setTextColor(R.id.tv_upcoming_delay_title, Color.parseColor("#065F46"))
                views.setTextViewText(R.id.tv_upcoming_delay_text, "Session is on time • Waiting to begin")
                views.setTextColor(R.id.tv_upcoming_delay_text, Color.parseColor("#047857"))
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

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        schedulePeriodicRefresh(context)
        fetchRemoteData(context)
        startShortBurstPolling(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        cancelPeriodicRefresh(context)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        schedulePeriodicRefresh(context)
        fetchRemoteData(context)
        startShortBurstPolling(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_REFRESH, Intent.ACTION_USER_PRESENT -> {
                fetchRemoteData(context)
                startShortBurstPolling(context)
            }
            ACTION_UPDATE_DATA -> {
                updateAllWidgets(context)
            }
        }
    }

    private fun startShortBurstPolling(context: Context) {
        val appContext = context.applicationContext
        burstRunnable?.let { mainHandler.removeCallbacks(it) }
        burstCount = 0
        val runnable = object : Runnable {
            override fun run() {
                if (burstCount < 6) {
                    burstCount++
                    fetchRemoteData(appContext)
                    mainHandler.postDelayed(this, 10_000L)
                }
            }
        }
        burstRunnable = runnable
        mainHandler.postDelayed(runnable, 10_000L)
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

                    prefs.edit().putString(KEY_WIDGET_DATA, responseJson).apply()
                    mainHandler.post {
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
