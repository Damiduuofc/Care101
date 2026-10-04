package com.damiduuofc.carelinkdoctorapp.widget

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.damiduuofc.carelinkdoctorapp.MainActivity
import com.damiduuofc.carelinkdoctorapp.R
import org.json.JSONArray
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
        const val KEY_NOTIFIED_IDS = "notified_ids_set"
        const val KEY_INITIAL_SYNC_DONE = "initial_notif_sync_done"

        const val CHANNEL_ID = "care101_live_alerts_v2"
        const val CHANNEL_NAME = "CareLink 101 Live Clinic Alerts"

        const val ACTION_REFRESH = "com.damiduuofc.carelinkdoctorapp.widget.ACTION_REFRESH"
        const val ACTION_UPDATE_DATA = "com.damiduuofc.carelinkdoctorapp.widget.ACTION_UPDATE_DATA"

        private val executor = Executors.newSingleThreadExecutor()
        private val mainHandler = Handler(Looper.getMainLooper())

        fun ensureNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
                    val channel = NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Real-time doctor arrival, delay, and queue alerts"
                        enableLights(true)
                        lightColor = Color.parseColor("#0891B2")
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 250, 150, 250)
                        lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                    }
                    manager.createNotificationChannel(channel)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to create notification channel", e)
                }
            }
        }

        fun startRealtimePolling(context: Context) {
            QueueForegroundService.startOrUpdate(context)
            fetchRemoteDataOnce(context) {
                QueueForegroundService.refreshNotificationAndRoom(context)
            }
        }

        fun showSystemNotification(context: Context, uniqueId: String, title: String, message: String) {
            try {
                ensureNotificationChannel(context)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        Log.w(TAG, "POST_NOTIFICATIONS permission not granted yet")
                        return
                    }
                }

                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val notifiedSet = prefs.getStringSet(KEY_NOTIFIED_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
                if (uniqueId.isNotEmpty() && notifiedSet.contains(uniqueId)) {
                    return
                }
                if (uniqueId.isNotEmpty()) {
                    notifiedSet.add(uniqueId)
                    // Keep set bounded
                    if (notifiedSet.size > 200) {
                        val trimmed = notifiedSet.toList().takeLast(120).toMutableSet()
                        prefs.edit().putStringSet(KEY_NOTIFIED_IDS, trimmed).apply()
                    } else {
                        prefs.edit().putStringSet(KEY_NOTIFIED_IDS, notifiedSet).apply()
                    }
                }

                val openIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    uniqueId.hashCode(),
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_STATUS)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setSound(defaultSoundUri)
                    .setVibrate(longArrayOf(0, 250, 150, 250))
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setColor(Color.parseColor("#0891B2"))

                val notifId = if (uniqueId.isNotEmpty()) (uniqueId.hashCode() and 0x7FFFFFFF) else (System.currentTimeMillis() % 100000).toInt()
                NotificationManagerCompat.from(context).notify(notifId, builder.build())
            } catch (e: Exception) {
                Log.e(TAG, "Error showing system notification", e)
            }
        }

        fun checkAndNotifyStateTransition(context: Context, prevJsonStr: String?, newJsonStr: String) {
            if (prevJsonStr.isNullOrEmpty()) return
            try {
                val prev = JSONObject(prevJsonStr)
                val curr = JSONObject(newJsonStr)

                val prevState = prev.optString("state", "empty")
                val currState = curr.optString("state", "empty")
                if (currState == "empty") return

                val doctor = formatDoctorName(curr.optString("doctorName", "Doctor"))
                val room = curr.optString("room", "Room TBA")
                val myToken = curr.optString("myToken", "--")
                val currOngoing = curr.optInt("ongoingToken", 0)
                val prevOngoing = prev.optInt("ongoingToken", 0)
                val currArrived = curr.optBoolean("isArrived", false)
                val prevArrived = prev.optBoolean("isArrived", false)
                val currDelayed = curr.optBoolean("isDelayed", false)
                val prevDelayed = prev.optBoolean("isDelayed", false)
                val channelingStatus = curr.optString("channelingStatus", "")
                val peopleAhead = curr.optInt("peopleAhead", -1)

                // 1. Doctor Arrival transition
                if (currArrived && !prevArrived) {
                    showSystemNotification(
                        context,
                        "arrived_${doctor}_${room}_${System.currentTimeMillis() / 60000}",
                        "Doctor Arrived at Clinic",
                        "$doctor has arrived at $room. Your Token is #$myToken."
                    )
                }

                // 2. Doctor Delay transition
                if (currDelayed && (!prevDelayed || prev.optString("channelingStatus") != channelingStatus)) {
                    showSystemNotification(
                        context,
                        "delay_${doctor}_${channelingStatus}",
                        "Doctor Delay Notice",
                        "$doctor is currently $channelingStatus ($room)."
                    )
                }

                // 3. Session Started transition
                if (currState == "queue" && prevState != "queue") {
                    showSystemNotification(
                        context,
                        "session_start_${doctor}_${currOngoing}",
                        "Channeling Session Started",
                        "$doctor has started seeing patients in $room. Ongoing Token: #$currOngoing (Your Token: #$myToken)."
                    )
                }

                // 4. Queue Token milestone transitions
                if (currState == "queue" && currOngoing != prevOngoing && currOngoing > 0) {
                    when (peopleAhead) {
                        0 -> showSystemNotification(
                            context,
                            "turn_now_${doctor}_${myToken}",
                            "It's Your Turn Now! (#$myToken)",
                            "Token #$myToken is now being called by $doctor in $room. Please enter now."
                        )
                        1 -> showSystemNotification(
                            context,
                            "turn_next_${doctor}_${myToken}_${currOngoing}",
                            "You Are Next in Queue!",
                            "1 patient ahead of you for $doctor ($room). Ongoing Token: #$currOngoing."
                        )
                        3 -> showSystemNotification(
                            context,
                            "turn_3_${doctor}_${myToken}_${currOngoing}",
                            "Queue Alert: 3 Patients Ahead",
                            "Only 3 patients ahead of your Token #$myToken for $doctor ($room)."
                        )
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Transition notification check failed", e)
            }
        }

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, QueueWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            for (widgetId in allWidgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId)
            }
        }

        /**
         * Event-driven one-shot fetch of the authenticated patient's queue/widget status.
         * Preserves last known queue data in SharedPreferences if the connection is temporarily lost.
         */
        fun fetchRemoteDataOnce(context: Context, onDoctorResolved: ((String?) -> Unit)? = null) {
            val appContext = context.applicationContext
            executor.execute {
                val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val apiUrl = prefs.getString(KEY_API_URL, null)
                val token = prefs.getString(KEY_AUTH_TOKEN, null)

                if (apiUrl.isNullOrEmpty() || token.isNullOrEmpty()) {
                    return@execute
                }

                val cleanUrl = if (apiUrl.endsWith("/")) apiUrl.dropLast(1) else apiUrl
                var resolvedDoctorId: String? = null

                // 1. Fetch Authenticated Patient Widget Status
                try {
                    val targetUrl = "$cleanUrl/appointments/widget-status"
                    val conn = (URL(targetUrl).openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        setRequestProperty("Authorization", "Bearer $token")
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("ngrok-skip-browser-warning", "true")
                        connectTimeout = 6000
                        readTimeout = 6000
                    }

                    if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                        val reader = BufferedReader(InputStreamReader(conn.inputStream))
                        val sb = StringBuilder()
                        var line: String?
                        while (reader.readLine().also { line = it } != null) {
                            sb.append(line)
                        }
                        reader.close()

                        val responseJson = sb.toString()
                        val prevJson = prefs.getString(KEY_WIDGET_DATA, null)
                        prefs.edit().putString(KEY_WIDGET_DATA, responseJson).apply()
                        try {
                            val parsed = JSONObject(responseJson)
                            val docId = parsed.optString("doctorId", "")
                            if (docId.isNotEmpty() && docId != "null") {
                                resolvedDoctorId = docId
                            }
                        } catch (_: Exception) {}

                        checkAndNotifyStateTransition(appContext, prevJson, responseJson)
                        mainHandler.post {
                            updateAllWidgets(appContext)
                            onDoctorResolved?.invoke(resolvedDoctorId)
                        }
                    }
                    conn.disconnect()
                } catch (e: Exception) {
                    // Do NOT clear or overwrite KEY_WIDGET_DATA when connection is lost
                    Log.w(TAG, "Widget status fetch failed (preserving last known state): ${e.message}")
                }

                // 2. Fetch Latest Unread Notifications to Pop on Phone Notification Bar
                try {
                    val notifUrl = "$cleanUrl/notifications"
                    val conn = (URL(notifUrl).openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        setRequestProperty("Authorization", "Bearer $token")
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("ngrok-skip-browser-warning", "true")
                        connectTimeout = 6000
                        readTimeout = 6000
                    }

                    if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                        val reader = BufferedReader(InputStreamReader(conn.inputStream))
                        val sb = StringBuilder()
                        var line: String?
                        while (reader.readLine().also { line = it } != null) {
                            sb.append(line)
                        }
                        reader.close()

                        val arr = JSONArray(sb.toString())
                        val isInitialSyncDone = prefs.getBoolean(KEY_INITIAL_SYNC_DONE, false)
                        val notifiedSet = prefs.getStringSet(KEY_NOTIFIED_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()

                        if (!isInitialSyncDone) {
                            // On very first sync, pop the latest unread notification if created within the last 10 minutes, and mark older ones as seen
                            val nowMs = System.currentTimeMillis()
                            for (i in 0 until arr.length()) {
                                val item = arr.optJSONObject(i) ?: continue
                                val id = item.optString("_id", "")
                                val isRead = item.optBoolean("read", false)
                                if (id.isNotEmpty()) {
                                    if (!isRead && i == 0) {
                                        val title = item.optString("title").ifEmpty { "CareLink 101 Alert" }
                                        val msg = item.optString("message", "")
                                        if (msg.isNotEmpty()) {
                                            showSystemNotification(context, id, title, msg)
                                        }
                                    } else {
                                        notifiedSet.add(id)
                                    }
                                }
                            }
                            prefs.edit()
                                .putStringSet(KEY_NOTIFIED_IDS, notifiedSet)
                                .putBoolean(KEY_INITIAL_SYNC_DONE, true)
                                .apply()
                        } else {
                            // Pop any new unread notifications
                            for (i in 0 until minOf(arr.length(), 5)) {
                                val item = arr.optJSONObject(i) ?: continue
                                val id = item.optString("_id", "")
                                val isRead = item.optBoolean("read", false)
                                if (id.isNotEmpty() && !isRead && !notifiedSet.contains(id)) {
                                    val title = when (item.optString("type", "")) {
                                        "arrival" -> item.optString("title").ifEmpty { "Doctor Arrived" }
                                        "doctor_status" -> item.optString("title").ifEmpty { "Doctor Delay Notice" }
                                        "reminder" -> item.optString("title").ifEmpty { "Live Queue Alert" }
                                        "appointment" -> item.optString("title").ifEmpty { "Appointment Confirmed" }
                                        "payment" -> item.optString("title").ifEmpty { "Payment Confirmed" }
                                        else -> item.optString("title").ifEmpty { "CareLink 101 Notification" }
                                    }
                                    val message = item.optString("message", "")
                                    if (message.isNotEmpty()) {
                                        showSystemNotification(context, id, title, message)
                                    }
                                }
                            }
                        }
                    }
                    conn.disconnect()
                } catch (e: Exception) {
                    Log.w(TAG, "Notification poll error: ${e.message}")
                }
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
            val doctor = formatDoctorName(data.optString("doctorName", "Doctor"))
            val myToken = formatTokenNumber(data.optString("myToken", "--"))
            val ongoingToken = formatTokenNumber(data.optString("ongoingToken", "--"))
            val peopleAhead = data.optInt("peopleAhead", 0)
            val isDelayed = data.optBoolean("isDelayed", false)
            val channelingStatus = data.optString("channelingStatus", "")

            views.setTextViewText(R.id.tv_queue_hospital_name, hospital)
            views.setTextViewText(R.id.tv_queue_room_name, room)
            views.setTextViewText(R.id.tv_queue_doctor_name, doctor)
            views.setTextViewText(R.id.tv_queue_my_token, "#$myToken")
            views.setTextViewText(R.id.tv_queue_ongoing_token, "#$ongoingToken")

            if (isDelayed) {
                views.setInt(R.id.badge_live_container, "setBackgroundResource", R.drawable.badge_status_delayed)
                views.setTextViewText(R.id.tv_queue_live_badge, "● DELAYED")
            } else {
                views.setInt(R.id.badge_live_container, "setBackgroundResource", R.drawable.badge_live)
                views.setTextViewText(R.id.tv_queue_live_badge, "● LIVE NOW")
            }

            var waitStatus = when {
                peopleAhead <= 0 -> "Your Turn is Now! Proceed to $room"
                peopleAhead == 1 -> "1 Patient Ahead of You • Get Ready"
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

            val doctor = formatDoctorName(data.optString("doctorName", "Doctor"))
            val myToken = formatTokenNumber(data.optString("myToken", "--"))
            val hospital = data.optString("hospitalName", "SUWASEWANA HOSPITAL").uppercase()
            val room = data.optString("room", "Room TBA")
            val formattedDate = data.optString("formattedDate", "Today")
            val time = data.optString("channelingTime", "")
            val isArrived = data.optBoolean("isArrived", false)
            val isDelayed = data.optBoolean("isDelayed", false) && !isArrived
            val channelingStatus = data.optString("channelingStatus", "")
            val delayMsg = data.optString("delayMessage", "")

            // Bind Header Pills
            views.setTextViewText(R.id.tv_upcoming_hospital_name, hospital)
            views.setTextViewText(R.id.tv_upcoming_room_name, room)

            // Bind Bento Cards (Doctor Info + Dedicated My Token Card)
            views.setTextViewText(R.id.tv_upcoming_doctor_name, doctor)
            views.setTextViewText(R.id.tv_upcoming_token, "#$myToken")

            val scheduleLine = if (time.isNotEmpty() && !time.equals("Scheduled Today", ignoreCase = true) && !time.equals("Scheduled", ignoreCase = true)) {
                "$formattedDate • $time"
            } else {
                "$formattedDate • Scheduled"
            }
            views.setTextViewText(R.id.tv_upcoming_datetime, scheduleLine)

            when {
                isArrived -> {
                    // 1. DOCTOR HAS ARRIVED STATE (Emerald Green)
                    views.setInt(R.id.badge_upcoming_status_container, "setBackgroundResource", R.drawable.badge_status_arrived)
                    views.setTextViewText(R.id.tv_upcoming_status_badge, "● ARRIVED")
                    views.setTextViewText(R.id.tv_upcoming_hospital_room, "Doctor is at clinic ($room)")

                    views.setInt(R.id.layout_upcoming_delay_banner, "setBackgroundResource", R.drawable.badge_arrived)
                    views.setImageViewResource(R.id.iv_upcoming_delay_icon, R.drawable.ic_check)
                    views.setTextViewText(R.id.tv_upcoming_delay_title, "DOCTOR ARRIVED:")
                    views.setTextColor(R.id.tv_upcoming_delay_title, Color.parseColor("#065F46"))
                    views.setTextViewText(R.id.tv_upcoming_delay_text, "At $room • Session starting soon")
                    views.setTextColor(R.id.tv_upcoming_delay_text, Color.parseColor("#047857"))
                }
                isDelayed -> {
                    // 2. DOCTOR DELAYED STATE (High-Contrast Warm Amber-Orange)
                    views.setInt(R.id.badge_upcoming_status_container, "setBackgroundResource", R.drawable.badge_status_delayed)
                    views.setTextViewText(R.id.tv_upcoming_status_badge, "● DELAYED")
                    views.setTextViewText(R.id.tv_upcoming_hospital_room, "Allocated to $room")

                    views.setInt(R.id.layout_upcoming_delay_banner, "setBackgroundResource", R.drawable.badge_delayed)
                    views.setImageViewResource(R.id.iv_upcoming_delay_icon, R.drawable.ic_warning)
                    views.setTextViewText(R.id.tv_upcoming_delay_title, "DELAY NOTICE:")
                    views.setTextColor(R.id.tv_upcoming_delay_title, Color.parseColor("#9A3412"))

                    val cleanDelayText = when {
                        channelingStatus.isNotEmpty() && !channelingStatus.equals("On Time", ignoreCase = true) -> channelingStatus
                        delayMsg.startsWith("Doctor Delayed:", ignoreCase = true) -> delayMsg.substringAfter(":").trim()
                        delayMsg.isNotEmpty() -> delayMsg
                        else -> "Session start is delayed"
                    }
                    views.setTextViewText(R.id.tv_upcoming_delay_text, cleanDelayText)
                    views.setTextColor(R.id.tv_upcoming_delay_text, Color.parseColor("#C2410C"))
                }
                else -> {
                    // 3. DOCTOR ON SCHEDULE STATE (Calm Medical Cyan)
                    views.setInt(R.id.badge_upcoming_status_container, "setBackgroundResource", R.drawable.badge_status_ontime)
                    views.setTextViewText(R.id.tv_upcoming_status_badge, "● ON TIME")
                    views.setTextViewText(R.id.tv_upcoming_hospital_room, "Allocated to $room")

                    views.setInt(R.id.layout_upcoming_delay_banner, "setBackgroundResource", R.drawable.badge_ontime)
                    views.setImageViewResource(R.id.iv_upcoming_delay_icon, R.drawable.ic_check)
                    views.setTextViewText(R.id.tv_upcoming_delay_title, "ON SCHEDULE:")
                    views.setTextColor(R.id.tv_upcoming_delay_title, Color.parseColor("#155E75"))
                    views.setTextViewText(R.id.tv_upcoming_delay_text, "Doctor on time • Waiting to arrive")
                    views.setTextColor(R.id.tv_upcoming_delay_text, Color.parseColor("#0E7490"))
                }
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

            val nextDoctor = formatDoctorName(data.optString("nextDoctorName", "Doctor"))
            val nextToken = formatTokenNumber(data.optString("nextToken", "--"))
            val nextHospital = data.optString("nextHospitalName", "Suwasewana Hospital")
            val nextRoom = data.optString("nextRoom", "Room TBA")
            val nextDate = data.optString("nextDate", "")

            views.setTextViewText(R.id.tv_completed_next_doctor, nextDoctor)
            views.setTextViewText(R.id.tv_completed_next_token, "Token #$nextToken")
            views.setTextViewText(R.id.tv_completed_next_hospital_room, "$nextHospital • $nextRoom")
            views.setTextViewText(R.id.tv_completed_next_date, "Date: $nextDate")
        }

        fun formatDoctorName(raw: String?): String {
            val trimmed = raw?.trim().orEmpty()
            if (trimmed.isEmpty() || trimmed.equals("null", ignoreCase = true)) {
                return "Doctor"
            }
            val withoutPrefix = trimmed.replaceFirst(Regex("^(?i)dr\\.?\\s*"), "").trim()
            if (withoutPrefix.isEmpty() || withoutPrefix.equals("Doctor", ignoreCase = true)) {
                return "Doctor"
            }
            return "Dr. $withoutPrefix"
        }

        private fun formatTokenNumber(raw: String): String {
            val num = raw.toIntOrNull()
            return if (num != null && num in 1..9) {
                String.format("%02d", num)
            } else {
                raw
            }
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        ensureNotificationChannel(context)
        QueueForegroundService.startOrUpdate(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        ensureNotificationChannel(context)
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        QueueForegroundService.startOrUpdate(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_REFRESH, Intent.ACTION_USER_PRESENT -> {
                QueueForegroundService.startOrUpdate(context)
                fetchRemoteDataOnce(context) {
                    QueueForegroundService.refreshNotificationAndRoom(context)
                }
            }
            ACTION_UPDATE_DATA -> {
                updateAllWidgets(context)
            }
        }
    }
}
