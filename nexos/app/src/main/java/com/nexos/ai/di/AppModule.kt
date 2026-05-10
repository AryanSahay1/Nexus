package com.nexos.ai.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.nexos.ai.data.local.NexosDatabase
import com.nexos.ai.data.local.dao.NoteDao
import com.nexos.ai.data.remote.api.AnthropicApi
import com.nexos.ai.data.remote.api.GeminiApi
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

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): NexosDatabase =
        Room.databaseBuilder(context, NexosDatabase::class.java, NexosDatabase.DB_NAME)
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideNoteDao(db: NexosDatabase): NoteDao = db.noteDao()

    @Provides
    @Singleton
    fun provideGson(): Gson = Gson()

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .apply {
            // Logging stays at NONE in release. We don't ship a debug overlay so
            // request bodies (which contain note text + API keys) never hit Logcat.
            addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.NONE })
        }
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, gson: Gson): Retrofit = Retrofit.Builder()
        // Each call uses an absolute @Url. baseUrl is required by Retrofit but unused.
        .baseUrl("https://nexos.invalid/")
        .client(client)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    @Provides
    @Singleton
    fun provideOpenAiApi(retrofit: Retrofit): OpenAiApi = retrofit.create(OpenAiApi::class.java)

    @Provides
    @Singleton
    fun provideGeminiApi(retrofit: Retrofit): GeminiApi = retrofit.create(GeminiApi::class.java)

    @Provides
    @Singleton
    fun provideAnthropicApi(retrofit: Retrofit): AnthropicApi = retrofit.create(AnthropicApi::class.java)
}
