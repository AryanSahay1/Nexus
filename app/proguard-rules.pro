# Keep Kotlin metadata
-keep class kotlin.Metadata { *; }

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.nexus.app.**$$serializer { *; }
-keepclassmembers class com.nexus.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.nexus.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Hilt
-keep class dagger.hilt.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ApplicationComponentManager
-keep @dagger.hilt.android.HiltAndroidApp class * { *; }

# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keepattributes Signature, Exceptions, *Annotation*

# AppAuth
-keep class net.openid.appauth.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# Tink (used by androidx.security.crypto) references errorprone annotations
# that are not present at runtime. Strip the warnings; the annotations have
# no runtime effect.
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.api.client.**
-dontwarn javax.lang.model.element.Modifier
