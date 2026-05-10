package com.nexos.ai.presentation.ui.screens.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexos.ai.presentation.ui.components.GhostButton
import com.nexos.ai.presentation.ui.components.PrimaryButton
import com.nexos.ai.presentation.ui.theme.NexosError
import com.nexos.ai.presentation.ui.theme.NexosOnSurface
import com.nexos.ai.presentation.ui.theme.NexosOnSurfaceMuted
import com.nexos.ai.presentation.ui.theme.NexosOutline
import com.nexos.ai.presentation.ui.theme.NexosPrimary
import com.nexos.ai.presentation.ui.theme.NexosSurface
import com.nexos.ai.presentation.ui.theme.NexosSurfaceElevated
import com.nexos.ai.presentation.viewmodel.NoteDetailViewModel
import com.nexos.ai.util.toFormattedDate

@Composable
fun NoteDetailScreen(
    onBack: () -> Unit,
    viewModel: NoteDetailViewModel = hiltViewModel(),
) {
    val note by viewModel.note.collectAsStateWithLifecycle()

    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var hydrated by remember { mutableStateOf(false) }

    LaunchedEffect(note?.id) {
        note?.let {
            if (!hydrated) {
                title = it.title
                content = it.content
                hydrated = true
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.systemBars)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BackChip(onBack)
            Spacer(Modifier.weight(1f))
            DangerChip(onClick = { viewModel.delete(onBack) })
        }

        Spacer(Modifier.height(16.dp))

        if (note == null) {
            Text("Loading…", color = NexosOnSurfaceMuted, fontSize = 14.sp)
        } else {
            note?.let { n ->
                Text(
                    text = n.timestamp.toFormattedDate("MMM dd, yyyy · h:mm a"),
                    color = NexosOnSurfaceMuted,
                    fontSize = 12.sp,
                )
                Spacer(Modifier.height(8.dp))
                BasicTextField(
                    value = title,
                    onValueChange = { title = it },
                    textStyle = TextStyle(
                        color = NexosOnSurface,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                    cursorBrush = SolidColor(NexosPrimary),
                    modifier = Modifier.fillMaxWidth(),
                    decorationBox = { inner ->
                        if (title.isEmpty()) Text(
                            "Untitled note",
                            color = NexosOnSurfaceMuted,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        inner()
                    },
                )

                if (n.summary.isNotBlank()) {
                    Spacer(Modifier.height(12.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(NexosPrimary.copy(alpha = 0.07f))
                            .border(1.dp, NexosPrimary.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                            .padding(14.dp),
                    ) {
                        Text(n.summary, color = NexosOnSurface, fontSize = 13.sp)
                    }
                }

                Spacer(Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(NexosSurface)
                        .border(1.dp, NexosOutline, RoundedCornerShape(14.dp))
                        .padding(16.dp),
                ) {
                    BasicTextField(
                        value = content,
                        onValueChange = { content = it },
                        textStyle = TextStyle(color = NexosOnSurface, fontSize = 15.sp, lineHeight = 22.sp),
                        cursorBrush = SolidColor(NexosPrimary),
                        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                        decorationBox = { inner ->
                            if (content.isEmpty()) Text("Note body…", color = NexosOnSurfaceMuted, fontSize = 15.sp)
                            inner()
                        },
                    )
                }

                Spacer(Modifier.height(20.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    GhostButton("Discard", onClick = onBack)
                    PrimaryButton(
                        text = "Save changes",
                        onClick = {
                            viewModel.update(title, content)
                            onBack()
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun BackChip(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(NexosSurfaceElevated)
            .border(1.dp, NexosOutline, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = NexosOnSurface, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun DangerChip(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(NexosError.copy(alpha = 0.1f))
            .border(1.dp, NexosError.copy(alpha = 0.3f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Outlined.Delete, contentDescription = "Delete", tint = NexosError, modifier = Modifier.size(18.dp))
    }
}
