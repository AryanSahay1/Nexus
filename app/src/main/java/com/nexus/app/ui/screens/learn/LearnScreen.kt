package com.nexus.app.ui.screens.learn

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexus.app.data.intents.DeepLinks
import com.nexus.app.data.learn.Tutorial
import com.nexus.app.data.learn.TutorialCategory
import com.nexus.app.data.learn.TutorialStep
import com.nexus.app.core.NexusResult
import com.nexus.app.ui.components.PrimaryButton

@Composable
fun LearnScreen(viewModel: LearnViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val active = state.activeTutorial

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

@Composable
private fun TutorialList(
    sections: List<LearnSection>,
    onPick: (Tutorial) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Learn") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item("intro") {
                IntroCard()
            }
            sections.forEach { section ->
                item("hdr-${section.category.name}") {
                    Column {
                        Text(
                            text = section.category.displayName,
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = section.category.description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                items(items = section.tutorials, key = { it.id }) { tutorial ->
                    TutorialRow(tutorial = tutorial, onPick = onPick)
                }
            }
            item("footer") { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun IntroCard() {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = "Built for everyone",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "These step-by-step guides walk you through the apps that are already on your phone — Gmail, Calendar, Contacts, the Camera. Big text, plain language, no rush. You don't need to set up any account to use this section.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun TutorialRow(tutorial: Tutorial, onPick: (Tutorial) -> Unit) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable { onPick(tutorial) }
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CategoryDot(category = tutorial.category)
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = tutorial.title,
                    style = MaterialTheme.typography.titleMedium.copy(fontSize = 18.sp),
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "${tutorial.steps.size} steps · about ${tutorial.estimatedMinutes} min",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun CategoryDot(category: TutorialCategory) {
    val color = when (category) {
        TutorialCategory.Email -> MaterialTheme.colorScheme.primary
        TutorialCategory.Calendar -> MaterialTheme.colorScheme.secondary
        TutorialCategory.Contacts -> MaterialTheme.colorScheme.tertiary
        TutorialCategory.Phone -> MaterialTheme.colorScheme.primary
        TutorialCategory.Social -> MaterialTheme.colorScheme.secondary
    }
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(color),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = category.displayName.first().toString(),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onPrimary
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
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = tutorial.title,
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "Step ${stepIndex + 1} of ${tutorial.steps.size}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Filled.Close, contentDescription = "Close tutorial")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
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
            ProgressBar(
                stepIndex = stepIndex,
                totalSteps = tutorial.steps.size
            )
            Spacer(Modifier.height(20.dp))
            // Large body — Assistive Mode uses 22sp body text for readability
            // by users with reduced vision, and high colour contrast.
            Text(
                text = step.body,
                style = MaterialTheme.typography.bodyLarge.copy(fontSize = 22.sp, lineHeight = 32.sp),
                color = MaterialTheme.colorScheme.onBackground
            )
            step.tip?.let {
                Spacer(Modifier.height(20.dp))
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Tip",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 18.sp),
                            color = MaterialTheme.colorScheme.onSurface
                        )
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
                PrimaryButton(
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
                OutlinedButton(
                    onClick = onPrevious,
                    enabled = !isFirstStep,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = null
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("Back")
                }
                PrimaryButton(
                    text = if (isLastStep) "Done" else "Next",
                    onClick = if (isLastStep) onClose else onNext,
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ProgressBar(stepIndex: Int, totalSteps: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        repeat(totalSteps) { i ->
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(
                        if (i <= stepIndex) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.surfaceVariant
                    )
            )
        }
    }
}
