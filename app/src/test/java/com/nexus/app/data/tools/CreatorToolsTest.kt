package com.nexus.app.data.tools

import com.google.common.truth.Truth.assertThat
import com.nexus.app.core.NexusResult
import kotlinx.coroutines.test.runTest
import org.junit.Test

class CreatorToolsTest {

    @Test
    fun `design_brief rejects when purpose is missing`() = runTest {
        val tool = DesignBriefTool()
        val result = tool.execute("""{"audience":"family"}""")
        assertThat(result.isErr).isTrue()
    }

    @Test
    fun `design_brief returns valid JSON with the required fields`() = runTest {
        val tool = DesignBriefTool()
        val result = tool.execute(
            """{"purpose":"instagram post","audience":"my followers","vibe":"playful"}"""
        )
        val payload = (result as NexusResult.Ok).value
        // Must round-trip through the JSON parser without crashing.
        val obj = parseSchema(payload)
        assertThat(obj.toString()).contains("purpose")
        assertThat(obj.toString()).contains("recommended_palette")
        assertThat(obj.toString()).contains("aspect_ratio")
        assertThat(obj.toString()).contains("call_to_action")
    }

    @Test
    fun `design_brief picks a square aspect ratio for instagram posts`() = runTest {
        val tool = DesignBriefTool()
        val result = tool.execute(
            """{"purpose":"instagram post","audience":"x"}"""
        )
        val payload = (result as NexusResult.Ok).value
        assertThat(payload).contains("1080×1080")
    }

    @Test
    fun `design_brief picks a vertical aspect ratio for reels`() = runTest {
        val tool = DesignBriefTool()
        val result = tool.execute(
            """{"purpose":"instagram reel","audience":"x"}"""
        )
        val payload = (result as NexusResult.Ok).value
        assertThat(payload).contains("1080×1920")
    }

    @Test
    fun `social_post_plan rejects when topic is missing`() = runTest {
        val tool = SocialPostPlanTool()
        val result = tool.execute("""{"platform":"instagram"}""")
        assertThat(result.isErr).isTrue()
    }

    @Test
    fun `social_post_plan applies the right character limit per platform`() = runTest {
        val tool = SocialPostPlanTool()
        val twitter = tool.execute(
            """{"platform":"x","topic":"hello"}"""
        ) as NexusResult.Ok
        val instagram = tool.execute(
            """{"platform":"instagram","topic":"hello"}"""
        ) as NexusResult.Ok
        assertThat(twitter.value).contains("\"character_limit\":280")
        assertThat(instagram.value).contains("\"character_limit\":2200")
    }

    @Test
    fun `social_post_plan is non-destructive`() {
        val tool = SocialPostPlanTool()
        assertThat(tool.isDestructive).isFalse()
    }

    @Test
    fun `design_brief is non-destructive`() {
        val tool = DesignBriefTool()
        assertThat(tool.isDestructive).isFalse()
    }
}
