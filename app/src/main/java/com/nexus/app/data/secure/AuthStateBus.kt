package com.nexus.app.data.secure

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Singleton hot-flow that fires whenever a credential is added or removed
 * (OpenAI key set, Google connect/disconnect, factory reset). The root
 * navigator listens so it can re-route between the onboarding gate and the
 * tab shell without requiring an app relaunch.
 */
@Singleton
class AuthStateBus @Inject constructor() {

    private val _events = MutableSharedFlow<Unit>(
        replay = 0,
        extraBufferCapacity = 8,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val events: SharedFlow<Unit> = _events.asSharedFlow()

    fun publish() {
        _events.tryEmit(Unit)
    }
}
