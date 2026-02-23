package com.postopguardian.ui.chat

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.postopguardian.R
import com.postopguardian.databinding.FragmentChatBinding
import com.postopguardian.models.ChatMessage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ChatFragment : Fragment() {
    private var _binding: FragmentChatBinding? = null
    private val binding get() = _binding!!

    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private var messagesListener: ListenerRegistration? = null

    private val currentUserId get() = auth.currentUser?.uid.orEmpty()
    private var partnerId: String = ""
    private var chatId: String = ""

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentChatBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        resolveChatContext()
        setupRecyclerView()
        setupSendButton()
        loadMessages()
    }

    private fun resolveChatContext() {
        partnerId = arguments?.getString("partnerId").orEmpty()
        if (partnerId.isBlank()) {
            partnerId = "doctor_456"
        }
        chatId = if (currentUserId < partnerId) "${currentUserId}_$partnerId" else "${partnerId}_$currentUserId"
    }

    private fun setupRecyclerView() {
        binding.chatRecyclerView.layoutManager = LinearLayoutManager(requireContext()).apply { stackFromEnd = true }
        binding.chatRecyclerView.adapter = ChatAdapter(currentUserId)
    }

    private fun setupSendButton() {
        binding.sendButton.setOnClickListener {
            val text = binding.chatInput.text.toString().trim()
            if (text.isEmpty()) return@setOnClickListener
            val message = ChatMessage(
                senderId = currentUserId,
                receiverId = partnerId,
                message = text,
                timestamp = System.currentTimeMillis()
            )
            db.collection("chats").document(chatId).collection("messages").add(message)
                .addOnSuccessListener { binding.chatInput.setText("") }
                .addOnFailureListener { Toast.makeText(requireContext(), getString(R.string.message_send_failed), Toast.LENGTH_SHORT).show() }
        }
    }

    private fun loadMessages() {
        messagesListener = db.collection("chats")
            .document(chatId)
            .collection("messages")
            .orderBy("timestamp", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null) return@addSnapshotListener
                val messages = snapshot.documents.mapNotNull { it.toObject(ChatMessage::class.java) }
                (binding.chatRecyclerView.adapter as ChatAdapter).submitList(messages)
                if (messages.isNotEmpty()) binding.chatRecyclerView.smoothScrollToPosition(messages.size - 1)
            }
    }

    override fun onDestroyView() {
        messagesListener?.remove()
        _binding = null
        super.onDestroyView()
    }
}

class ChatAdapter(private val currentUserId: String) : RecyclerView.Adapter<ChatViewHolder>() {
    private val messages = mutableListOf<ChatMessage>()

    fun submitList(newMessages: List<ChatMessage>) {
        messages.clear()
        messages.addAll(newMessages)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_chat_message, parent, false)
        return ChatViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChatViewHolder, position: Int) {
        holder.bind(messages[position], messages[position].senderId == currentUserId)
    }

    override fun getItemCount(): Int = messages.size
}

class ChatViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val container: LinearLayout = itemView.findViewById(R.id.container)
    private val body: TextView = itemView.findViewById(R.id.messageText)
    private val meta: TextView = itemView.findViewById(R.id.timeText)

    fun bind(message: ChatMessage, mine: Boolean) {
        body.text = message.message
        body.background = itemView.context.getDrawable(
            if (mine) R.drawable.bg_chat_mine else R.drawable.bg_chat_theirs
        )
        body.setTextColor(itemView.context.getColor(if (mine) android.R.color.white else android.R.color.black))
        container.gravity = if (mine) android.view.Gravity.END else android.view.Gravity.START
        meta.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(message.timestamp))
    }
}
