package com.nexos.ai.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.nexos.ai.BuildConfig
import com.nexos.ai.data.local.NexosDatabase
import com.nexos.ai.data.local.dao.NoteDao
import com.nexos.ai.data.remote.api.AnthropicApi
import com.nexos.ai.data.remote.api.GeminiApi
import com.nexos.ai.data.remote.api.GroqApi
import com.nexos.ai.data.remote.api.OpenAiApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    /* ---------- Database ---------- */

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): NexosDatabase =
        Room.databaseBuilder(context, NexosDatabase::class.java, NexosDatabase.NAME)
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideNoteDao(db: NexosDatabase): NoteDao = db.noteDao()

    /* ---------- Networking ---------- */

    @Provides
    @Singleton
    fun provideGson(): Gson = GsonBuilder()
        .setLenient()
        .create()

    @Provides
    @Singleton
    fun provideOkHttp(): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
        if (BuildConfig.DEBUG) {
            builder.addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            })
        }
        return builder.build()
    }

    @Provides @Singleton
    fun provideOpenAi(client: OkHttpClient, gson: Gson): OpenAiApi =
        Retrofit.Builder().baseUrl(OpenAiApi.BASE_URL).client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build().create(OpenAiApi::class.java)

    @Provides @Singleton
    fun provideGroq(client: OkHttpClient, gson: Gson): GroqApi =
        Retrofit.Builder().baseUrl(GroqApi.BASE_URL).client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build().create(GroqApi::class.java)

    @Provides @Singleton
    fun provideGemini(client: OkHttpClient, gson: Gson): GeminiApi =
        Retrofit.Builder().baseUrl(GeminiApi.BASE_URL).client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build().create(GeminiApi::class.java)

    @Provides @Singleton
    fun provideAnthropic(client: OkHttpClient, gson: Gson): AnthropicApi =
        Retrofit.Builder().baseUrl(AnthropicApi.BASE_URL).client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build().create(AnthropicApi::class.java)
}
