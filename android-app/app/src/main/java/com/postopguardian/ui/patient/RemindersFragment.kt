package com.postopguardian.ui.patient

import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.postopguardian.R
import com.postopguardian.databinding.FragmentRemindersBinding
import com.postopguardian.models.Reminder
import java.util.Calendar

class RemindersFragment : Fragment() {
    private var _binding: FragmentRemindersBinding? = null
    private val binding get() = _binding!!

    private lateinit var remindersAdapter: RemindersAdapter
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private val patientId get() = auth.currentUser?.uid.orEmpty()
    private var remindersListener: com.google.firebase.firestore.ListenerRegistration? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRemindersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecycler()
        loadReminders()
        binding.addReminderButton.setOnClickListener { showAddReminderDialog() }
    }

    private fun setupRecycler() {
        remindersAdapter = RemindersAdapter(
            onToggle = { reminder, enabled ->
                db.collection("reminders").document(reminder.reminderId).update("enabled", enabled)
            },
            onDelete = { reminder ->
                db.collection("reminders").document(reminder.reminderId).delete()
                    .addOnSuccessListener { Toast.makeText(requireContext(), getString(R.string.deleted), Toast.LENGTH_SHORT).show() }
            }
        )
        binding.remindersRecyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.remindersRecyclerView.adapter = remindersAdapter
    }

    private fun loadReminders() {
        remindersListener = db.collection("reminders")
            .whereEqualTo("patient_id", patientId)
            .orderBy("time")
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null) return@addSnapshotListener
                val list = snapshot.documents.map {
                    Reminder(
                        reminderId = it.id,
                        patient_id = it.getString("patient_id").orEmpty(),
                        title = it.getString("title").orEmpty(),
                        time = it.getString("time").orEmpty(),
                        repeat_daily = it.getBoolean("repeat_daily") ?: true,
                        enabled = it.getBoolean("enabled") ?: true,
                        timestamp = it.getLong("timestamp") ?: 0L
                    )
                }
                remindersAdapter.submitList(list)
            }
    }

    private fun showAddReminderDialog() {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_add_reminder, null)
        val titleInput = view.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.reminderTitleEditText)
        val timeButton = view.findViewById<android.widget.Button>(R.id.timePickerButton)
        val repeatSwitch = view.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.repeatDailySwitch)
        val calendarSwitch = view.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.addToCalendarSwitch)
        val saveButton = view.findViewById<android.widget.Button>(R.id.saveReminderButton)

        val now = Calendar.getInstance()
        var selectedHour = now.get(Calendar.HOUR_OF_DAY)
        var selectedMinute = now.get(Calendar.MINUTE)
        timeButton.text = String.format("%02d:%02d", selectedHour, selectedMinute)

        timeButton.setOnClickListener {
            TimePickerDialog(requireContext(), { _, hour, minute ->
                selectedHour = hour
                selectedMinute = minute
                timeButton.text = String.format("%02d:%02d", hour, minute)
            }, selectedHour, selectedMinute, true).show()
        }

        val dialog = MaterialAlertDialogBuilder(requireContext()).setView(view).setCancelable(true).show()
        saveButton.setOnClickListener {
            val title = titleInput.text?.toString()?.trim().orEmpty()
            if (title.isBlank()) {
                titleInput.error = getString(R.string.required)
                return@setOnClickListener
            }

            val time = String.format("%02d:%02d", selectedHour, selectedMinute)
            val payload = mapOf(
                "patient_id" to patientId,
                "title" to title,
                "time" to time,
                "repeat_daily" to repeatSwitch.isChecked,
                "enabled" to true,
                "timestamp" to System.currentTimeMillis()
            )
            db.collection("reminders").add(payload)
                .addOnSuccessListener {
                    if (calendarSwitch.isChecked) addToGoogleCalendar(title, selectedHour, selectedMinute, repeatSwitch.isChecked)
                    dialog.dismiss()
                }
                .addOnFailureListener {
                    Toast.makeText(requireContext(), getString(R.string.reminder_save_failed), Toast.LENGTH_SHORT).show()
                }
        }
    }

    private fun addToGoogleCalendar(title: String, hour: Int, minute: Int, repeatDaily: Boolean) {
        val start = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
        }.timeInMillis
        val end = start + 30L * 60 * 1000
        val intent = Intent(Intent.ACTION_INSERT)
            .setData(Uri.parse("content://com.android.calendar/events"))
            .putExtra("title", title)
            .putExtra("beginTime", start)
            .putExtra("endTime", end)
            .putExtra("rrule", if (repeatDaily) "FREQ=DAILY" else "")
        runCatching { startActivity(intent) }.onFailure {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://calendar.google.com/calendar/r")))
        }
    }

    override fun onDestroyView() {
        remindersListener?.remove()
        _binding = null
        super.onDestroyView()
    }
}

class RemindersAdapter(
    private val onToggle: (Reminder, Boolean) -> Unit,
    private val onDelete: (Reminder) -> Unit
) : RecyclerView.Adapter<ReminderViewHolder>() {

    private val reminders = mutableListOf<Reminder>()

    fun submitList(items: List<Reminder>) {
        reminders.clear()
        reminders.addAll(items)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ReminderViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_reminder, parent, false)
        return ReminderViewHolder(view, onToggle, onDelete)
    }

    override fun onBindViewHolder(holder: ReminderViewHolder, position: Int) = holder.bind(reminders[position])

    override fun getItemCount(): Int = reminders.size
}

class ReminderViewHolder(
    itemView: View,
    private val onToggle: (Reminder, Boolean) -> Unit,
    private val onDelete: (Reminder) -> Unit
) : RecyclerView.ViewHolder(itemView) {
    private val title = itemView.findViewById<android.widget.TextView>(R.id.reminderTitle)
    private val subtitle = itemView.findViewById<android.widget.TextView>(R.id.reminderSubtitle)
    private val toggle = itemView.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.reminderToggle)

    fun bind(reminder: Reminder) {
        title.text = reminder.title
        subtitle.text = "${reminder.time} ${if (reminder.repeat_daily) "(Daily)" else "(Custom)"}"
        toggle.setOnCheckedChangeListener(null)
        toggle.isChecked = reminder.enabled
        toggle.setOnCheckedChangeListener { _, checked -> onToggle(reminder, checked) }
        itemView.setOnLongClickListener {
            MaterialAlertDialogBuilder(itemView.context)
                .setTitle(itemView.context.getString(R.string.delete_reminder))
                .setMessage(itemView.context.getString(R.string.delete_reminder_confirm))
                .setPositiveButton(itemView.context.getString(R.string.delete)) { _, _ -> onDelete(reminder) }
                .setNegativeButton(itemView.context.getString(R.string.cancel), null)
                .show()
            true
        }
    }
}
