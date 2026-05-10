package com.nexus.app.ui.screens.learn

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexus.app.core.NexusResult
import com.nexus.app.data.intents.DeepLinks
import com.nexus.app.data.learn.Tutorial
import com.nexus.app.data.learn.TutorialCategory
import com.nexus.app.ui.components.leather.LeatherButton
import com.nexus.app.ui.components.leather.LeatherCard
import com.nexus.app.ui.components.leather.LeatherCardVariant
import com.nexus.app.ui.components.leather.OutlineLeatherButton
import com.nexus.app.ui.components.leather.ProgressDots
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette

@Composable
fun LearnScreen(viewModel: LearnViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    // Crossfade between the tutorial list and the player so the leather
    // frame stays still while the journal page turns.
    Crossfade(
        targetState = state.activeTutorial,
        animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Moderate),
        label = "learnContent"
    ) { active ->
        if (active == null) {
            TutorialList(
                sections = state.sections,
                onPick = viewModel::openTutorial
            )
        } else {
            TutorialPlayer(
                tutorial = active,
                stepIndex = state.activeStepIndex,
                errorMessage = state.activeError,
                onNext = viewModel::nextStep,
                onPrevious = viewModel::previousStep,
                onClose = viewModel::closeTutorial,
                onActionError = viewModel::reportActionError
            )
        }
    }
}

@Composable
private fun TutorialList(
    sections: List<LearnSection>,
    onPick: (Tutorial) -> Unit
) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Learn", color = LeatherPalette.PandaIvory) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item("intro") { IntroCard() }
            sections.forEachIndexed { sectionIndex, section ->
                item("hdr-${section.category.name}") {
                    Column(modifier = Modifier.padding(top = 8.dp)) {
                        Text(
                            text = section.category.displayName,
                            style = MaterialTheme.typography.headlineMedium,
                            color = LeatherPalette.PandaIvory
                        )
                        Text(
                            text = section.category.description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = LeatherPalette.PandaCream.copy(alpha = 0.85f)
                        )
                    }
                }
                itemsIndexed(
                    items = section.tutorials,
                    key = { _, tutorial -> tutorial.id }
                ) { rowIndex, tutorial ->
                    val totalIndex = sectionIndex * 8 + rowIndex
                    StaggeredEnter(index = totalIndex) {
                        TutorialRow(
                            tutorial = tutorial,
                            grainSeed = totalIndex,
                            onPick = onPick
                        )
                    }
                }
            }
            item("footer") { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun StaggeredEnter(index: Int, content: @Composable () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(
            initialOffsetY = { it / 4 },
            animationSpec = LeatherMotion.tweenLeather(
                durationMillis = LeatherMotion.Normal + index * 60,
                easing = LeatherMotion.EaseOutLeather
            )
        ) + fadeIn(LeatherMotion.tweenLeather(LeatherMotion.Normal + index * 60)),
        exit = fadeOut() + slideOutVertically()
    ) {
        content()
    }
}

@Composable
private fun IntroCard() {
    LeatherCard(
        modifier = Modifier.fillMaxWidth(),
        variant = LeatherCardVariant.Highlight,
        elevationLevel = 2,
        grainSeed = 0
    ) {
        Column {
            Text(
                text = "Built for everyone",
                style = MaterialTheme.typography.headlineMedium,
                color = LeatherPalette.PandaIvory
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Step-by-step guides for the apps already on your phone — Gmail, Calendar, Contacts, the Camera. Big text, plain language, no rush.",
                style = MaterialTheme.typography.bodyLarge,
                color = LeatherPalette.PandaCream
            )
        }
    }
}

@Composable
private fun TutorialRow(
    tutorial: Tutorial,
    grainSeed: Int,
    onPick: (Tutorial) -> Unit
) {
    LeatherCard(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .clickable { onPick(tutorial) },
        elevationLevel = 1,
        grainSeed = grainSeed,
        contentPadding = 16.dp
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CategoryDot(category = tutorial.category)
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = tutorial.title,
                    style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                    color = LeatherPalette.PandaIvory
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "${tutorial.steps.size} steps · about ${tutorial.estimatedMinutes} min",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LeatherPalette.PandaCream.copy(alpha = 0.8f)
                )
            }
        }
    }
}

@Composable
private fun CategoryDot(category: TutorialCategory) {
    val palette = when (category) {
        TutorialCategory.Email -> LeatherPalette.ThreadFresh
        TutorialCategory.Calendar -> LeatherPalette.WarningAmber
        TutorialCategory.Contacts -> LeatherPalette.ThreadLime
        TutorialCategory.Phone -> LeatherPalette.Saddle
        TutorialCategory.Social -> LeatherPalette.Tan
    }
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(palette),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = category.displayName.first().toString(),
            style = MaterialTheme.typography.titleMedium,
            color = LeatherPalette.PandaCharcoal
        )
    }
}

@Composable
private fun TutorialPlayer(
    tutorial: Tutorial,
    stepIndex: Int,
    errorMessage: String?,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onClose: () -> Unit,
    onActionError: (String?) -> Unit
) {
    val context = LocalContext.current
    val step = tutorial.steps[stepIndex]
    val isLastStep = stepIndex == tutorial.steps.lastIndex
    val isFirstStep = stepIndex == 0

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = tutorial.title,
                            style = MaterialTheme.typography.titleMedium,
                            color = LeatherPalette.PandaIvory
                        )
                        Text(
                            text = "Step ${stepIndex + 1} of ${tutorial.steps.size}",
                            style = MaterialTheme.typography.bodySmall,
                            color = LeatherPalette.PandaCream.copy(alpha = 0.75f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "Close tutorial",
                            tint = LeatherPalette.PandaIvory
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            ProgressDots(
                currentIndex = stepIndex,
                totalSteps = tutorial.steps.size
            )
            Spacer(Modifier.height(20.dp))

            // Crossfade the body itself when the user advances — the leather
            // page is unchanged, only the writing on it.
            Crossfade(
                targetState = stepIndex,
                animationSpec = LeatherMotion.tweenLeather(LeatherMotion.Moderate),
                label = "tutorialStepBody"
            ) { idx ->
                val current = tutorial.steps[idx]
                Column {
                    Text(
                        text = current.body,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontSize = 22.sp,
                            lineHeight = 32.sp
                        ),
                        color = LeatherPalette.PandaIvory
                    )
                    current.tip?.let {
                        Spacer(Modifier.height(20.dp))
                        LeatherCard(
                            modifier = Modifier.fillMaxWidth(),
                            variant = LeatherCardVariant.Warning,
                            elevationLevel = 1,
                            contentPadding = 16.dp,
                            grainSeed = idx + 100
                        ) {
                            Column {
                                Text(
                                    text = "Tip",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = LeatherPalette.WarningAmber
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = it,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 18.sp),
                                    color = LeatherPalette.PandaCream
                                )
                            }
                        }
                    }
                }
            }
            errorMessage?.let {
                Spacer(Modifier.height(16.dp))
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            Spacer(Modifier.weight(1f))

            step.actionIntent?.let { intent ->
                LeatherButton(
                    text = step.actionLabel ?: "Open",
                    onClick = {
                        when (val r = DeepLinks.launch(context, intent)) {
                            is NexusResult.Ok -> onActionError(null)
                            is NexusResult.Err -> onActionError(r.error.message)
                        }
                    }
                )
                Spacer(Modifier.height(12.dp))
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    OutlineLeatherButton(
                        text = "Back",
                        onClick = onPrevious,
                        enabled = !isFirstStep
                    )
                }
                Box(modifier = Modifier.weight(1f)) {
                    LeatherButton(
                        text = if (isLastStep) "Done" else "Next",
                        onClick = if (isLastStep) onClose else onNext
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

