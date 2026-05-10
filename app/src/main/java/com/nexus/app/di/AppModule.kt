package com.nexus.app.di

import android.content.Context
import androidx.room.Room
import com.nexus.app.data.db.ChatHistoryDao
import com.nexus.app.data.db.NexusDatabase
import com.nexus.app.data.db.PreferencesDao
import com.nexus.app.data.network.openAiRetrofit
import com.nexus.app.data.network.googleRetrofit
import com.nexus.app.data.network.AuthInterceptor
import com.nexus.app.data.service.GoogleApiService
import com.nexus.app.data.service.OpenAiApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): NexusDatabase =
        Room.databaseBuilder(context, NexusDatabase::class.java, "nexus.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun providePreferencesDao(db: NexusDatabase): PreferencesDao = db.preferencesDao()

    @Provides
    fun provideChatHistoryDao(db: NexusDatabase): ChatHistoryDao = db.chatHistoryDao()

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(
            HttpLoggingInterceptor { /* never log network bodies; this is a no-op */ }
                .apply { level = HttpLoggingInterceptor.Level.NONE }
        )
        .build()

    @Provides
    @Singleton
    fun provideOpenAiService(okHttpClient: OkHttpClient): OpenAiApiService =
        openAiRetrofit(okHttpClient).create(OpenAiApiService::class.java)

    @Provides
    @Singleton
    fun provideGoogleService(
        okHttpClient: OkHttpClient,
        authInterceptor: AuthInterceptor
    ): GoogleApiService {
        val authedClient = okHttpClient.newBuilder()
            .addInterceptor(authInterceptor)
            .build()
        return googleRetrofit(authedClient).create(GoogleApiService::class.java)
    }
}
