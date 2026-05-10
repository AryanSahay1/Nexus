package com.nexus.app.di

import com.nexus.app.data.tools.CalendarCreateEventTool
import com.nexus.app.data.tools.CalendarNextEventTool
import com.nexus.app.data.tools.DesignBriefTool
import com.nexus.app.data.tools.ForgetTool
import com.nexus.app.data.tools.GmailReadRecentTool
import com.nexus.app.data.tools.GmailSendTool
import com.nexus.app.data.tools.RecallTool
import com.nexus.app.data.tools.RememberTool
import com.nexus.app.data.tools.SocialPostPlanTool
import com.nexus.app.domain.agent.Tool
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet

@Module
@InstallIn(SingletonComponent::class)
abstract class ToolsModule {

    @Binds @IntoSet abstract fun bindRemember(impl: RememberTool): Tool
    @Binds @IntoSet abstract fun bindRecall(impl: RecallTool): Tool
    @Binds @IntoSet abstract fun bindForget(impl: ForgetTool): Tool
    @Binds @IntoSet abstract fun bindGmailRead(impl: GmailReadRecentTool): Tool
    @Binds @IntoSet abstract fun bindGmailSend(impl: GmailSendTool): Tool
    @Binds @IntoSet abstract fun bindCalendarNext(impl: CalendarNextEventTool): Tool
    @Binds @IntoSet abstract fun bindCalendarCreate(impl: CalendarCreateEventTool): Tool
    @Binds @IntoSet abstract fun bindDesignBrief(impl: DesignBriefTool): Tool
    @Binds @IntoSet abstract fun bindSocialPostPlan(impl: SocialPostPlanTool): Tool
}
