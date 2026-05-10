package com.nexos.ai.service

import android.animation.ValueAnimator
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.nexos.ai.MainActivity
import com.nexos.ai.R
import dagger.hilt.android.AndroidEntryPoint
import kotlin.math.abs

/**
 * Persistent floating bubble. Tap to open quick-actions (camera + mic). Long-press to drag.
 * Uses transform + alpha animations only (per motion design rules).
 */
@AndroidEntryPoint
class FloatingButtonService : Service() {

    private lateinit var windowManager: WindowManager
    private var rootView: FrameLayout? = null
    private var bubble: View? = null
    private var actionsRow: LinearLayout? = null

    private var params: WindowManager.LayoutParams? = null

    private var initialX = 0
    private var initialY = 0
    private var touchX = 0f
    private var touchY = 0f
    private var didDrag = false
    private var actionsExpanded = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        NotificationChannels.ensure(this)
        startInForeground()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        addOverlay()
    }

    override fun onDestroy() {
        try {
            rootView?.let { windowManager.removeView(it) }
        } catch (_: Throwable) {}
        rootView = null
        super.onDestroy()
    }

    private fun startInForeground() {
        val pi = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification: Notification = NotificationCompat.Builder(this, NotificationChannels.FLOATING)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.floating_service_text))
            .setSmallIcon(R.drawable.ic_nexos_notification)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(pi)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                0, // unspecified type pre-API 34 is fine
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun addOverlay() {
        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
            )
        }

        val bubbleSize = dp(56f)
        val bubbleView = ImageView(this).apply {
            background = ContextCompat.getDrawable(this@FloatingButtonService, R.drawable.floating_button_bg)
            setImageResource(R.drawable.ic_nexos_notification)
            setColorFilter(Color.parseColor("#00E676"))
            layoutParams = FrameLayout.LayoutParams(bubbleSize, bubbleSize, Gravity.END)
            elevation = dp(6f).toFloat()
            isClickable = true
            isFocusable = true
            setOnClickListener {
                if (didDrag) return@setOnClickListener
                performHaptic(this)
                toggleActions()
            }
        }
        bubble = bubbleView

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(8f), 0, dp(8f), 0)
            visibility = View.GONE
            alpha = 0f
            translationY = dp(12f).toFloat()
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                bubbleSize,
                Gravity.END or Gravity.TOP,
            ).apply { topMargin = bubbleSize + dp(8f) }
        }
        actionsRow = row
        row.addView(buildActionButton(R.drawable.ic_nexos_notification, "📸") {
            sendBroadcast(Intent(NexosReceiver.ACTION_CAPTURE_SCREENSHOT).setPackage(packageName))
            collapseActions()
        })
        row.addView(buildActionButton(R.drawable.ic_nexos_notification, "🎙") {
            sendBroadcast(Intent(NexosReceiver.ACTION_START_VOICE).setPackage(packageName))
            collapseActions()
        })

        root.addView(bubbleView)
        root.addView(row)
        rootView = root

        attachDragListener(bubbleView)

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = resources.displayMetrics.widthPixels - bubbleSize - dp(16f)
            y = resources.displayMetrics.heightPixels / 3
        }
        try {
            windowManager.addView(root, params)
            // Bubble entrance animation
            bubbleView.scaleX = 0f; bubbleView.scaleY = 0f
            bubbleView.animate()
                .scaleX(1f).scaleY(1f)
                .setDuration(420)
                .setInterpolator(OvershootInterpolator(2.4f))
                .start()
        } catch (t: Throwable) {
            android.util.Log.e(TAG, "Failed to add overlay (missing SYSTEM_ALERT_WINDOW?)", t)
            stopSelf()
        }
    }

    private fun attachDragListener(target: View) {
        target.setOnTouchListener { _, event ->
            val p = params ?: return@setOnTouchListener false
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = p.x; initialY = p.y
                    touchX = event.rawX; touchY = event.rawY
                    didDrag = false
                    target.animate().scaleX(0.92f).scaleY(0.92f).setDuration(80).start()
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - touchX).toInt()
                    val dy = (event.rawY - touchY).toInt()
                    if (abs(dx) > 16 || abs(dy) > 16) didDrag = true
                    if (didDrag) {
                        p.x = initialX + dx
                        p.y = initialY + dy
                        try { rootView?.let { windowManager.updateViewLayout(it, p) } } catch (_: Throwable) {}
                    }
                    didDrag
                }
                MotionEvent.ACTION_UP -> {
                    target.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                    if (didDrag) {
                        snapToEdge()
                        true
                    } else {
                        target.performClick()
                        true
                    }
                }
                else -> false
            }
        }
    }

    private fun snapToEdge() {
        val p = params ?: return
        val root = rootView ?: return
        val screenWidth = resources.displayMetrics.widthPixels
        val targetX = if (p.x + (bubble?.width ?: 0) / 2 < screenWidth / 2) 0
        else screenWidth - (bubble?.width ?: 0)
        val animator = ValueAnimator.ofInt(p.x, targetX).apply {
            duration = 280
            interpolator = OvershootInterpolator(1.8f)
            addUpdateListener {
                p.x = it.animatedValue as Int
                try { windowManager.updateViewLayout(root, p) } catch (_: Throwable) {}
            }
        }
        animator.start()
    }

    private fun toggleActions() {
        val row = actionsRow ?: return
        if (actionsExpanded) collapseActions() else expandActions(row)
    }

    private fun expandActions(row: LinearLayout) {
        actionsExpanded = true
        row.visibility = View.VISIBLE
        row.alpha = 0f
        row.translationY = dp(12f).toFloat()
        row.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(220)
            .setInterpolator(OvershootInterpolator(1.4f))
            .start()
    }

    private fun collapseActions() {
        val row = actionsRow ?: return
        actionsExpanded = false
        row.animate()
            .alpha(0f)
            .translationY(dp(12f).toFloat())
            .setDuration(150)
            .withEndAction { row.visibility = View.GONE }
            .start()
    }

    private fun buildActionButton(@Suppress("SameParameterValue") iconRes: Int, label: String, onClick: () -> Unit): View {
        val size = dp(48f)
        return FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(size, size).apply { marginEnd = dp(8f) }
            background = ContextCompat.getDrawable(this@FloatingButtonService, R.drawable.floating_button_bg)
            elevation = dp(4f).toFloat()
            isClickable = true
            isFocusable = true
            addView(android.widget.TextView(this@FloatingButtonService).apply {
                text = label
                setTextColor(Color.parseColor("#00E676"))
                textSize = 22f
                gravity = Gravity.CENTER
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                )
            })
            setOnClickListener {
                performHaptic(this)
                animate().scaleX(0.9f).scaleY(0.9f).setDuration(80).withEndAction {
                    animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                }.start()
                onClick()
            }
        }
    }

    private fun performHaptic(view: View) {
        view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
    }

    private fun dp(value: Float): Int = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics,
    ).toInt()

    @Suppress("unused")
    private fun ignoredCtxRef(): Context = this

    private companion object {
        const val TAG = "NexOS/FloatingButtonService"
        const val NOTIFICATION_ID = 4202
    }
}
