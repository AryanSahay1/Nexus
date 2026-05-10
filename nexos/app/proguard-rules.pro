# Hilt
-keep class dagger.hilt.** { *; }
-keep @dagger.hilt.android.lifecycle.HiltViewModel class * { *; }

# Retrofit / OkHttp
-keepattributes Signature, InnerClasses, Exceptions, *Annotation*
-keep class retrofit2.** { *; }
-keepclassmembernames interface * { @retrofit2.http.* <methods>; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson DTOs
-keep class com.nexos.ai.data.remote.dto.** { *; }
-keepattributes Signature
-keep class com.google.gson.** { *; }

# Compose
-keep class androidx.compose.** { *; }

# ML Kit text recognition
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.** { *; }

# Enums
-keepclassmembers enum * { public static **[] values(); public static ** valueOf(java.lang.String); }
