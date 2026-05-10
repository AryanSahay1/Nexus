# Keep app classes
-keep class com.nexos.ai.** { *; }

# Retrofit
-keepattributes Signature, Exceptions, *Annotation*, InnerClasses, EnclosingMethod
-keep class retrofit2.** { *; }
-keepclassmembernames interface * { @retrofit2.http.* <methods>; }
-dontwarn retrofit2.**

# OkHttp / Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**

# Gson
-keepattributes Signature
-keepattributes EnclosingMethod
-keep class com.google.gson.** { *; }
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Hilt / Dagger
-keep class dagger.hilt.** { *; }
-keep @dagger.hilt.android.lifecycle.HiltViewModel class * { *; }
-dontwarn dagger.hilt.**

# ML Kit
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.** { *; }
-dontwarn com.google.mlkit.**

# Enums + Parcelable
-keepclassmembers enum * { public static **[] values(); public static ** valueOf(java.lang.String); }
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}
