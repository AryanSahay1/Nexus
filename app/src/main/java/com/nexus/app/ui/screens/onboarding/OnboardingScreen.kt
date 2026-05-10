package com.nexus.app.ui.screens.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexus.app.R
import com.nexus.app.ui.components.leather.LeatherButton
import com.nexus.app.ui.components.leather.OutlineLeatherButton
import com.nexus.app.ui.components.leather.LeatherCard
import com.nexus.app.ui.components.leather.LeatherCardVariant
import com.nexus.app.ui.theme.leather.LeatherMotion
import com.nexus.app.ui.theme.leather.LeatherPalette
import com.nexus.app.ui.theme.leather.LeatherTone
import com.nexus.app.ui.theme.leather.leatherSurface

@Composable
fun OnboardingScreen(
    onContinue: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                OnboardingUiEvent.Finished -> onContinue()
            }
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        modifier = Modifier.leatherSurface(LeatherTone.Walnut)
    ) { padding ->
        // Animate between disclosure and api-key steps with a horizontal slide
        // + crossfade so the user feels they've moved forward (not just that
        // the page swapped).
        AnimatedContent(
            targetState = state.step,
            transitionSpec = {
                val moderate = tween<androidx.compose.ui.unit.IntOffset>(
                    durationMillis = LeatherMotion.Moderate,
                    easing = LeatherMotion.EaseOutLeather
                )
                val moderateF = tween<Float>(
                    durationMillis = LeatherMotion.Moderate,
                    easing = LeatherMotion.EaseOutLeather
                )
                val fastF = tween<Float>(
                    durationMillis = LeatherMotion.Fast,
                    easing = LeatherMotion.EaseInLeather
                )
                (slideIntoContainer(
                    AnimatedContentTransitionScope.SlideDirection.Left,
                    animationSpec = moderate
                ) + fadeIn(moderateF)) togetherWith
                    (slideOutOfContainer(
                        AnimatedContentTransitionScope.SlideDirection.Left,
                        animationSpec = moderate
                    ) + fadeOut(fastF))
            },
            modifier = Modifier.padding(padding),
            label = "onboardingStep"
        ) { step ->
            when (step) {
                OnboardingStep.Disclosure -> DisclosureContent(
                    onAcknowledge = viewModel::acknowledgeDisclosure
                )
                OnboardingStep.ApiKey -> ApiKeyContent(
                    state = state,
                    onApiKeyChange = viewModel::onApiKeyChange,
                    onSave = viewModel::saveKey,
                    onSkip = viewModel::skipApiKey
                )
            }
        }
    }
}

@Composable
private fun DisclosureContent(
    onAcknowledge: () -> Unit,
    modifier: Modifier = Modifier
) {
    // One-shot subtle scale-in for the leather card on the first composition.
    var entered by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { entered = true }
    val cardScale by animateFloatAsState(
        targetValue = if (entered) 1f else 0.96f,
        animationSpec = LeatherMotion.springLeather(),
        label = "disclosureScale"
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Top
    ) {
        Spacer(Modifier.height(48.dp))
        Text(
            text = stringResource(R.string.onboarding_title),
            style = MaterialTheme.typography.displayLarge,
            color = LeatherPalette.PandaIvory
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.onboarding_subtitle),
            style = MaterialTheme.typography.bodyLarge,
            color = LeatherPalette.PandaCream
        )
        Spacer(Modifier.height(32.dp))

        // Place 2 of 4 — the assistive purpose disclosure card.
        LeatherCard(
            modifier = Modifier
                .fillMaxWidth()
                .scale(cardScale),
            variant = LeatherCardVariant.Highlight,
            elevationLevel = 2,
            grainSeed = 1
        ) {
            Column {
                Text(
                    text = stringResource(R.string.assistive_disclosure_title),
                    style = MaterialTheme.typography.headlineMedium,
                    color = LeatherPalette.PandaIvory
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.assistive_disclosure_body),
                    style = MaterialTheme.typography.bodyLarge,
                    color = LeatherPalette.PandaCream
                )
            }
        }
        Spacer(Modifier.height(24.dp))
        LeatherButton(
            text = stringResource(R.string.assistive_disclosure_continue),
            onClick = onAcknowledge,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun ApiKeyContent(
    state: OnboardingUiState,
    onApiKeyChange: (String) -> Unit,
    onSave: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.api_key_title),
            style = MaterialTheme.typography.displayMedium,
            color = LeatherPalette.PandaIvory
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.api_key_subtitle),
            style = MaterialTheme.typography.bodyLarge,
            color = LeatherPalette.PandaCream
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = state.apiKey,
            onValueChange = onApiKeyChange,
            placeholder = { Text(stringResource(R.string.api_key_hint)) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done
            ),
            isError = state.errorMessage != null,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = LeatherPalette.ThreadFresh,
                unfocusedBorderColor = LeatherPalette.ThreadMoss,
                cursorColor = LeatherPalette.ThreadFresh,
                focusedTextColor = LeatherPalette.PandaIvory,
                unfocusedTextColor = LeatherPalette.PandaCream
            ),
            supportingText = {
                state.errorMessage?.let {
                    Text(text = it, color = MaterialTheme.colorScheme.error)
                }
            },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(20.dp))
        LeatherButton(
            text = stringResource(R.string.api_key_save),
            onClick = onSave,
            loading = state.isSaving,
            enabled = state.apiKey.isNotBlank()
        )
        Spacer(Modifier.height(12.dp))
        OutlineLeatherButton(
            text = stringResource(R.string.onboarding_skip),
            onClick = onSkip
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.onboarding_skip_explainer),
            style = MaterialTheme.typography.bodySmall,
            color = LeatherPalette.PandaCream.copy(alpha = 0.75f),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)
        )
    }
}
