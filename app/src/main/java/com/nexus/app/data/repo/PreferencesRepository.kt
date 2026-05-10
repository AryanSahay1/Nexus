package com.nexus.app.data.repo

import com.nexus.app.core.NexusErrorCode
import com.nexus.app.core.NexusResult
import com.nexus.app.core.runCatchingNexus
import com.nexus.app.data.db.PreferenceEntity
import com.nexus.app.data.db.PreferencesDao
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

@Singleton
class PreferencesRepository @Inject constructor(
    private val dao: PreferencesDao
) {
    fun observe(): Flow<List<UserPreference>> = dao.observeAll().map { rows ->
        rows.map { it.toDomain() }
    }

    suspend fun snapshot(): Map<String, String> =
        dao.getAll().associate { it.key to it.value }

    suspend fun upsert(key: String, value: String, category: String = "general"): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.DATABASE_ERROR) {
            val now = System.currentTimeMillis()
            val existing = dao.findByKey(key)
            val row = PreferenceEntity(
                id = existing?.id ?: 0L,
                key = key,
                value = value,
                category = category,
                createdAt = existing?.createdAt ?: now,
                updatedAt = now
            )
            dao.upsert(row)
        }

    suspend fun delete(key: String): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.DATABASE_ERROR) { dao.deleteByKey(key) }

    suspend fun deleteAll(): NexusResult<Unit> =
        runCatchingNexus(NexusErrorCode.DATABASE_ERROR) { dao.deleteAll() }
}

data class UserPreference(
    val key: String,
    val value: String,
    val category: String,
    val updatedAt: Long
)

private fun PreferenceEntity.toDomain() = UserPreference(
    key = key,
    value = value,
    category = category,
    updatedAt = updatedAt
)
