package com.damiduuofc.carelinkdoctorapp.widget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.damiduuofc.carelinkdoctorapp.MainActivity
import com.damiduuofc.carelinkdoctorapp.R
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

class QueueForegroundService : Service() {

    companion object {
        private const val TAG = "QueueForegroundService"
        const val SERVICE_CHANNEL_ID = "care101_realtime_queue_service_v1"
        const val SERVICE_CHANNEL_NAME = "CareLink 101 Live Queue Service"
        const val FOREGROUND_NOTIFICATION_ID = 9101

        const val ACTION_START_OR_UPDATE = "com.damiduuofc.carelinkdoctorapp.widget.ACTION_FGS_START_OR_UPDATE"
        const val ACTION_JOIN_DOCTOR_ROOM = "com.damiduuofc.carelinkdoctorapp.widget.ACTION_FGS_JOIN_ROOM"
        const val ACTION_REFRESH_NOTIFICATION = "com.damiduuofc.carelinkdoctorapp.widget.ACTION_FGS_REFRESH_NOTIF"
        const val ACTION_STOP_SERVICE = "com.damiduuofc.carelinkdoctorapp.widget.ACTION_FGS_STOP"

        fun startOrUpdate(context: Context) {
            val appContext = context.applicationContext
            val prefs = appContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            val token = prefs.getString(QueueWidgetProvider.KEY_AUTH_TOKEN, null)
            val patientId = prefs.getString(QueueWidgetProvider.KEY_PATIENT_ID, null)
            if (token.isNullOrEmpty() || patientId.isNullOrEmpty()) {
                return
            }
            try {
                val intent = Intent(appContext, QueueForegroundService::class.java).apply {
                    action = ACTION_START_OR_UPDATE
                }
                ContextCompat.startForegroundService(appContext, intent)
            } catch (e: Exception) {
                Log.w(TAG, "Unable to start QueueForegroundService: ${e.message}")
            }
        }

        fun refreshNotificationAndRoom(context: Context) {
            val appContext = context.applicationContext
            val prefs = appContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            val token = prefs.getString(QueueWidgetProvider.KEY_AUTH_TOKEN, null)
            if (token.isNullOrEmpty()) return
            try {
                val intent = Intent(appContext, QueueForegroundService::class.java).apply {
                    action = ACTION_REFRESH_NOTIFICATION
                }
                ContextCompat.startForegroundService(appContext, intent)
            } catch (e: Exception) {
                Log.w(TAG, "Unable to refresh QueueForegroundService: ${e.message}")
            }
        }

        fun stop(context: Context) {
            try {
                val appContext = context.applicationContext
                val intent = Intent(appContext, QueueForegroundService::class.java)
                appContext.stopService(intent)
            } catch (e: Exception) {
                Log.w(TAG, "Unable to stop QueueForegroundService: ${e.message}")
            }
        }
    }

    private var socket: Socket? = null
    private var activeSocketOrigin: String? = null
    private var activeAuthToken: String? = null
    private var activePatientId: String? = null
    private var isSocketConnected: Boolean = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private val debouncedServerSyncRunnable = Runnable {
        QueueWidgetProvider.fetchRemoteDataOnce(applicationContext) { resolvedDoctorId ->
            if (!resolvedDoctorId.isNullOrEmpty()) {
                joinDoctorRoomIfConnected(resolvedDoctorId)
            }
            updatePersistentNotification()
        }
    }

    override fun onCreate() {
        super.onCreate()
        ensureServiceNotificationChannel()
        promoteToForeground()
        registerNetworkCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureServiceNotificationChannel()
        promoteToForeground()

        val prefs = applicationContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(QueueWidgetProvider.KEY_AUTH_TOKEN, null)
        val patientId = prefs.getString(QueueWidgetProvider.KEY_PATIENT_ID, null)
        val apiUrl = prefs.getString(QueueWidgetProvider.KEY_API_URL, null)

        if (intent?.action == ACTION_STOP_SERVICE || token.isNullOrEmpty() || patientId.isNullOrEmpty() || apiUrl.isNullOrEmpty()) {
            disconnectSocket()
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        when (intent?.action) {
            ACTION_REFRESH_NOTIFICATION, ACTION_JOIN_DOCTOR_ROOM -> {
                updatePersistentNotification()
                joinCurrentDoctorRoomFromPrefs()
                ensureSocketConnection(apiUrl, token, patientId)
            }
            else -> {
                ensureSocketConnection(apiUrl, token, patientId)
                updatePersistentNotification()
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        mainHandler.removeCallbacks(debouncedServerSyncRunnable)
        unregisterNetworkCallback()
        disconnectSocket()
        super.onDestroy()
    }

    private fun ensureServiceNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
                val channel = NotificationChannel(
                    SERVICE_CHANNEL_ID,
                    SERVICE_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Keeps CareLink 101 queue widget updated in real time via Socket.IO"
                    setShowBadge(false)
                    enableLights(false)
                    enableVibration(false)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }
                manager.createNotificationChannel(channel)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to create foreground service notification channel", e)
            }
        }
    }

    private fun buildPersistentNotification(): Notification {
        val prefs = applicationContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val rawJson = prefs.getString(QueueWidgetProvider.KEY_WIDGET_DATA, null)

        var title = "CareLink 101 Live Queue Active"
        var contentText = if (isSocketConnected) {
            "Connected for real-time clinic & queue updates"
        } else {
            "Maintaining last known queue status • Reconnecting..."
        }

        if (!rawJson.isNullOrEmpty()) {
            try {
                val data = JSONObject(rawJson)
                val state = data.optString("state", "empty")
                val doctor = QueueWidgetProvider.formatDoctorName(data.optString("doctorName", "Doctor"))
                val room = data.optString("room", "Room TBA")
                val myToken = data.optString("myToken", "--")
                val ongoingToken = data.optString("ongoingToken", "--")
                val peopleAhead = data.optInt("peopleAhead", 0)
                val isArrived = data.optBoolean("isArrived", false)
                val isDelayed = data.optBoolean("isDelayed", false)
                val channelingStatus = data.optString("channelingStatus", "On Time")

                when (state) {
                    "queue" -> {
                        title = "Live Queue: #$ongoingToken Ongoing • Your Token: #$myToken"
                        val waitText = when {
                            peopleAhead <= 0 -> "Your Turn Now!"
                            peopleAhead == 1 -> "1 Patient Ahead"
                            else -> "$peopleAhead Patients Ahead"
                        }
                        contentText = "$doctor ($room) • $waitText"
                        if (!isSocketConnected) {
                            contentText += " • Reconnecting..."
                        }
                    }
                    "upcoming" -> {
                        val statusBadge = when {
                            isArrived -> "Doctor Arrived"
                            isDelayed -> "Delayed ($channelingStatus)"
                            else -> "On Schedule"
                        }
                        title = "Upcoming: $doctor • Token #$myToken"
                        contentText = "$room • $statusBadge"
                        if (!isSocketConnected) {
                            contentText += " • Reconnecting..."
                        }
                    }
                    "completed" -> {
                        if (data.optBoolean("hasUpcoming", false)) {
                            val nextDoc = QueueWidgetProvider.formatDoctorName(data.optString("nextDoctorName", "Doctor"))
                            val nextToken = data.optString("nextToken", "--")
                            title = "Next Appointment: $nextDoc"
                            contentText = "Token #$nextToken • Live updates active"
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error building notification from widget state", e)
            }
        }

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(contentText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(contentText))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setColor(Color.parseColor("#0891B2"))
            .setContentIntent(openPendingIntent)
            .build()
    }

    private fun promoteToForeground() {
        val notification = buildPersistentNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    FOREGROUND_NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(FOREGROUND_NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Fallback startForeground without serviceType: ${e.message}")
            try {
                startForeground(FOREGROUND_NOTIFICATION_ID, notification)
            } catch (inner: Exception) {
                Log.e(TAG, "Failed to startForeground", inner)
            }
        }
    }

    private fun updatePersistentNotification() {
        try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            manager.notify(FOREGROUND_NOTIFICATION_ID, buildPersistentNotification())
        } catch (e: Exception) {
            Log.w(TAG, "Unable to update persistent notification", e)
        }
    }

    private fun extractSocketOrigin(apiUrl: String): String {
        return try {
            val uri = URI(apiUrl.trim())
            val scheme = uri.scheme ?: "http"
            val host = uri.host ?: return apiUrl
            val port = uri.port
            if (port != -1) "$scheme://$host:$port" else "$scheme://$host"
        } catch (e: Exception) {
            apiUrl.replace(Regex("/api/?$"), "")
        }
    }

    private fun ensureSocketConnection(apiUrl: String, token: String, patientId: String) {
        val origin = extractSocketOrigin(apiUrl)

        if (socket != null &&
            activeSocketOrigin == origin &&
            activeAuthToken == token &&
            activePatientId == patientId
        ) {
            if (socket?.connected() != true) {
                socket?.connect()
            } else {
                joinCurrentDoctorRoomFromPrefs()
            }
            return
        }

        disconnectSocket()
        activeSocketOrigin = origin
        activeAuthToken = token
        activePatientId = patientId

        try {
            val options = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 2000
                reconnectionDelayMax = 10000
                timeout = 10000
                extraHeaders = mapOf(
                    "ngrok-skip-browser-warning" to listOf("true"),
                    "Authorization" to listOf("Bearer $token")
                )
            }

            val newSocket = IO.socket(origin, options)
            socket = newSocket

            newSocket.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "⚡ Foreground Service Socket.IO Connected to $origin")
                isSocketConnected = true
                joinCurrentDoctorRoomFromPrefs()
                mainHandler.post {
                    updatePersistentNotification()
                }
                scheduleServerReconciliation(0L)
            }

            newSocket.on(Socket.EVENT_DISCONNECT) {
                Log.d(TAG, "🔌 Foreground Service Socket.IO Disconnected (preserving last known widget state)")
                isSocketConnected = false
                mainHandler.post {
                    updatePersistentNotification()
                }
            }

            newSocket.on(Socket.EVENT_CONNECT_ERROR) { args ->
                val err = if (args.isNotEmpty()) args[0]?.toString() else "unknown"
                Log.w(TAG, "Socket.IO connect error (preserving last known state): $err")
                isSocketConnected = false
                mainHandler.post {
                    updatePersistentNotification()
                }
            }

            // 1. Live Queue Token Updates (e.g. Nurse changes queue from 25 -> 26)
            newSocket.on("queueUpdated") { args ->
                val payload = parseJsonArg(args)
                if (payload != null) {
                    handleImmediateQueueUpdated(payload)
                }
                scheduleServerReconciliation(250L)
            }

            // 2. Doctor Status Update (Session Start / End / Arrival / Delay / Queue)
            newSocket.on("doctorStatusUpdated") { args ->
                val updatedDoc = parseJsonArg(args)
                if (updatedDoc != null) {
                    handleImmediateDoctorStatusUpdated(updatedDoc)
                }
                scheduleServerReconciliation(250L)
            }

            // 3. Doctor Arrival Alert
            newSocket.on("doctorArrivalAlert") { args ->
                val payload = parseJsonArg(args)
                if (payload != null) {
                    handleImmediateDoctorArrival(payload)
                }
                scheduleServerReconciliation(250L)
            }

            // 4. Doctor Delay Alert
            newSocket.on("doctorDelayAlert") { args ->
                val payload = parseJsonArg(args)
                if (payload != null) {
                    handleImmediateDoctorDelay(payload)
                }
                scheduleServerReconciliation(250L)
            }

            // 5. Appointment Updated
            newSocket.on("appointmentUpdated") {
                scheduleServerReconciliation(150L)
            }

            // 6. Direct Patient Notification
            newSocket.on("newNotification") { args ->
                val notif = parseJsonArg(args)
                if (notif != null) {
                    val notifUserId = notif.optString("userId", "")
                    if (notifUserId.isNotEmpty() && notifUserId == activePatientId) {
                        val id = notif.optString("_id", "${System.currentTimeMillis()}")
                        val title = notif.optString("title").ifEmpty { "CareLink 101 Alert" }
                        val msg = notif.optString("message", "")
                        if (msg.isNotEmpty()) {
                            QueueWidgetProvider.showSystemNotification(applicationContext, id, title, msg)
                        }
                        scheduleServerReconciliation(150L)
                    }
                }
            }

            newSocket.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Socket.IO in Foreground Service", e)
        }
    }

    private fun parseJsonArg(args: Array<out Any?>?): JSONObject? {
        if (args == null || args.isEmpty()) return null
        val first = args[0] ?: return null
        return try {
            when (first) {
                is JSONObject -> first
                is String -> JSONObject(first)
                else -> JSONObject(first.toString())
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun handleImmediateQueueUpdated(payload: JSONObject) {
        val prefs = applicationContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val prevJson = prefs.getString(QueueWidgetProvider.KEY_WIDGET_DATA, null) ?: return

        try {
            val currentData = JSONObject(prevJson)
            val ourDoctorId = currentData.optString("doctorId", "")
            val eventDoctorId = payload.optString("doctorId", "")

            // Strict privacy/isolation: only update if this event is for the authenticated patient's doctor
            if (ourDoctorId.isNotEmpty() && eventDoctorId.isNotEmpty() && ourDoctorId != eventDoctorId) {
                return
            }

            val newToken = if (payload.has("currentToken")) {
                payload.optInt("currentToken", -1)
            } else {
                payload.optInt("currentServingNumber", -1)
            }
            if (newToken < 0) return

            val myTokenNum = currentData.optString("myToken", "0").toIntOrNull() ?: 0
            val peopleAhead = maxOf(0, myTokenNum - newToken)
            val sessionEnded = payload.optBoolean("sessionEndedToday", false)
            val room = payload.optString("allocatedRoom", "").ifEmpty { currentData.optString("room", "Room TBA") }

            currentData.put("state", if (sessionEnded) "completed" else "queue")
            currentData.put("ongoingToken", newToken)
            currentData.put("peopleAhead", peopleAhead)
            currentData.put("isArrived", true)
            currentData.put("room", room)

            val updatedJson = currentData.toString()
            if (updatedJson != prevJson) {
                prefs.edit().putString(QueueWidgetProvider.KEY_WIDGET_DATA, updatedJson).apply()
                QueueWidgetProvider.checkAndNotifyStateTransition(applicationContext, prevJson, updatedJson)
                mainHandler.post {
                    QueueWidgetProvider.updateAllWidgets(applicationContext)
                    updatePersistentNotification()
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error handling immediate queueUpdated event", e)
        }
    }

    private fun handleImmediateDoctorStatusUpdated(updatedDoc: JSONObject) {
        val prefs = applicationContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val prevJson = prefs.getString(QueueWidgetProvider.KEY_WIDGET_DATA, null) ?: return

        try {
            val currentData = JSONObject(prevJson)
            val ourDoctorId = currentData.optString("doctorId", "")
            val docId = updatedDoc.optString("_id", "")
            if (ourDoctorId.isNotEmpty() && docId.isNotEmpty() && ourDoctorId != docId) {
                return
            }

            val currentServing = updatedDoc.optInt("currentQueueNumber", currentData.optInt("ongoingToken", 0))
            val myTokenNum = currentData.optString("myToken", "0").toIntOrNull() ?: 0
            val peopleAhead = maxOf(0, myTokenNum - currentServing)
            val isArrived = if (updatedDoc.has("isArrived")) updatedDoc.optBoolean("isArrived") else currentData.optBoolean("isArrived", false)
            val channelingStatus = updatedDoc.optString("channelingStatus", currentData.optString("channelingStatus", "On Time"))
            val sessionStarted = updatedDoc.optBoolean("sessionStarted", false)
            val sessionEnded = updatedDoc.optBoolean("sessionEndedToday", false)
            val room = updatedDoc.optString("allocatedRoom", "").ifEmpty { currentData.optString("room", "Room TBA") }

            if (sessionStarted && !sessionEnded) {
                currentData.put("state", "queue")
                currentData.put("ongoingToken", currentServing)
                currentData.put("peopleAhead", peopleAhead)
                currentData.put("isArrived", true)
                currentData.put("isDelayed", !channelingStatus.equals("On Time", ignoreCase = true))
                currentData.put("channelingStatus", channelingStatus)
                currentData.put("room", room)
            } else if (!sessionStarted && !sessionEnded) {
                val isDelayed = !channelingStatus.equals("On Time", ignoreCase = true) && !isArrived
                currentData.put("state", "upcoming")
                currentData.put("isArrived", isArrived)
                currentData.put("isDelayed", isDelayed)
                currentData.put("channelingStatus", channelingStatus)
                currentData.put("room", room)
            }

            val updatedJson = currentData.toString()
            if (updatedJson != prevJson) {
                prefs.edit().putString(QueueWidgetProvider.KEY_WIDGET_DATA, updatedJson).apply()
                QueueWidgetProvider.checkAndNotifyStateTransition(applicationContext, prevJson, updatedJson)
                mainHandler.post {
                    QueueWidgetProvider.updateAllWidgets(applicationContext)
                    updatePersistentNotification()
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error handling immediate doctorStatusUpdated event", e)
        }
    }

    private fun handleImmediateDoctorArrival(payload: JSONObject) {
        val prefs = applicationContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val prevJson = prefs.getString(QueueWidgetProvider.KEY_WIDGET_DATA, null) ?: return

        try {
            val currentData = JSONObject(prevJson)
            val ourDoctorId = currentData.optString("doctorId", "")
            val eventDocId = payload.optString("doctorId", "")
            if (ourDoctorId.isNotEmpty() && eventDocId.isNotEmpty() && ourDoctorId != eventDocId) {
                return
            }

            val isArrived = payload.optBoolean("isArrived", true)
            val room = payload.optString("allocatedRoom", "").ifEmpty { currentData.optString("room", "Room TBA") }
            currentData.put("isArrived", isArrived)
            if (isArrived) currentData.put("isDelayed", false)
            currentData.put("room", room)

            val updatedJson = currentData.toString()
            prefs.edit().putString(QueueWidgetProvider.KEY_WIDGET_DATA, updatedJson).apply()
            QueueWidgetProvider.checkAndNotifyStateTransition(applicationContext, prevJson, updatedJson)
            mainHandler.post {
                QueueWidgetProvider.updateAllWidgets(applicationContext)
                updatePersistentNotification()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error handling immediate doctorArrivalAlert", e)
        }
    }

    private fun handleImmediateDoctorDelay(payload: JSONObject) {
        val prefs = applicationContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val prevJson = prefs.getString(QueueWidgetProvider.KEY_WIDGET_DATA, null) ?: return

        try {
            val currentData = JSONObject(prevJson)
            val ourDoctorId = currentData.optString("doctorId", "")
            val eventDocId = payload.optString("doctorId", "")
            if (ourDoctorId.isNotEmpty() && eventDocId.isNotEmpty() && ourDoctorId != eventDocId) {
                return
            }

            val status = payload.optString("channelingStatus", payload.optString("status", "Delayed"))
            val isDelayed = !status.equals("On Time", ignoreCase = true)
            val room = payload.optString("allocatedRoom", "").ifEmpty { currentData.optString("room", "Room TBA") }
            currentData.put("channelingStatus", status)
            currentData.put("isDelayed", isDelayed && !currentData.optBoolean("isArrived", false))
            currentData.put("room", room)

            val updatedJson = currentData.toString()
            prefs.edit().putString(QueueWidgetProvider.KEY_WIDGET_DATA, updatedJson).apply()
            QueueWidgetProvider.checkAndNotifyStateTransition(applicationContext, prevJson, updatedJson)
            mainHandler.post {
                QueueWidgetProvider.updateAllWidgets(applicationContext)
                updatePersistentNotification()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error handling immediate doctorDelayAlert", e)
        }
    }

    private fun joinCurrentDoctorRoomFromPrefs() {
        val prefs = applicationContext.getSharedPreferences(QueueWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val rawJson = prefs.getString(QueueWidgetProvider.KEY_WIDGET_DATA, null) ?: return
        try {
            val data = JSONObject(rawJson)
            val doctorId = data.optString("doctorId", "")
            if (doctorId.isNotEmpty() && doctorId != "null") {
                joinDoctorRoomIfConnected(doctorId)
            }
        } catch (e: Exception) {
            // Ignore malformed JSON
        }
    }

    private fun joinDoctorRoomIfConnected(doctorId: String) {
        val currentSocket = socket
        if (currentSocket != null && currentSocket.connected() && doctorId.isNotEmpty() && doctorId != "null") {
            currentSocket.emit("joinDoctorRoom", doctorId)
            Log.d(TAG, "📡 Joined doctor room: doctor:$doctorId")
        }
    }

    private fun scheduleServerReconciliation(delayMs: Long) {
        mainHandler.removeCallbacks(debouncedServerSyncRunnable)
        mainHandler.postDelayed(debouncedServerSyncRunnable, delayMs)
    }

    private fun disconnectSocket() {
        try {
            socket?.off()
            socket?.disconnect()
            socket = null
            isSocketConnected = false
            activeSocketOrigin = null
        } catch (e: Exception) {
            Log.w(TAG, "Error disconnecting socket", e)
        }
    }

    private fun registerNetworkCallback() {
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
            connectivityManager = cm
            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    super.onAvailable(network)
                    Log.d(TAG, "🌐 Network available: ensuring Socket.IO connection")
                    val currentSocket = socket
                    if (currentSocket != null && !currentSocket.connected()) {
                        currentSocket.connect()
                    }
                    scheduleServerReconciliation(300L)
                }

                override fun onLost(network: Network) {
                    super.onLost(network)
                    Log.d(TAG, "🌐 Network lost: retaining last known queue widget data")
                    isSocketConnected = false
                    mainHandler.post {
                        updatePersistentNotification()
                    }
                }
            }
            networkCallback = callback
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            cm.registerNetworkCallback(request, callback)
        } catch (e: Exception) {
            Log.w(TAG, "Unable to register NetworkCallback: ${e.message}")
        }
    }

    private fun unregisterNetworkCallback() {
        try {
            val cm = connectivityManager
            val cb = networkCallback
            if (cm != null && cb != null) {
                cm.unregisterNetworkCallback(cb)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Unable to unregister NetworkCallback: ${e.message}")
        } finally {
            networkCallback = null
            connectivityManager = null
        }
    }
}
