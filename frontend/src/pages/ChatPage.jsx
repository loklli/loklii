import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Send, Flag } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

let socket;

export default function ChatPage() {
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('loklii_token');
    socket = io(import.meta.env.VITE_BACKEND_URL || '', { auth: { token } });
    socket.on('new_message', (msg) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => [...prev, msg]);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    });
    socket.on('user_typing', ({ conversationId: cid }) => {
      if (cid === conversationId) {
        setTyping(true);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(false), 2000);
      }
    });
    return () => { socket?.disconnect(); };
  }, [conversationId]);

  useEffect(() => {
    api.get('/chat/conversations').then((r) => setConversations(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (conversationId) {
      socket?.emit('join_conversation', conversationId);
      api.get(`/chat/conversations/${conversationId}/messages`).then((r) => {
        setMessages(r.data);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 100);
      }).catch(() => toast.error('Failed to load messages.'));
    }
  }, [conversationId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setLoading(true);
    try {
      await api.post('/chat/messages', { conversationId, content: newMessage });
      socket?.emit('send_message', { conversationId, content: newMessage });
      setNewMessage('');
    } catch {
      toast.error('Failed to send message.');
    } finally {
      setLoading(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    socket?.emit('typing', { conversationId });
  };

  const getOtherParticipant = (convo) => {
    return convo.participant_1?.id === user?.id ? convo.participant_2 : convo.participant_1;
  };

  // Show inbox if no conversation selected
  if (!conversationId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-white px-4 py-4 border-b border-gray-100">
          <h1 className="font-bold text-xl">{t('nav.messages')}</h1>
        </div>
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-5xl mb-4">💬</p>
            <p className="text-gray-500">No conversations yet.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {conversations.map((convo) => {
              const other = getOtherParticipant(convo);
              return (
                <div
                  key={convo.id}
                  onClick={() => navigate(`/chat/${convo.id}`)}
                  className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 bg-white cursor-pointer active:bg-gray-50"
                >
                  <div className="w-12 h-12 bg-amber rounded-full flex items-center justify-center text-white font-bold">
                    {other?.first_name?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{other?.first_name} {other?.last_name}</p>
                    {convo.orders && (
                      <p className="text-xs text-gray-400">Order #{convo.orders.order_number}</p>
                    )}
                  </div>
                  {convo.last_message_at && (
                    <span className="text-xs text-gray-400">{new Date(convo.last_message_at).toLocaleDateString()}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 safe-top">
        <button onClick={() => navigate('/chat')}><ChevronLeft size={24} /></button>
        <p className="font-semibold">Chat</p>
        <button className="ml-auto" onClick={() => toast('Reporting...', { icon: '🚩' })}>
          <Flag size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.map((msg, i) => {
          const isMine = msg.sender_id === user?.id || msg.senderId === user?.id;
          return (
            <div key={msg.id || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMine ? 'bg-amber text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'} ${msg.is_flagged ? 'opacity-70 italic' : ''}`}>
                {msg.content}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-2xl text-xs text-gray-500">typing...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 safe-bottom bg-white">
        <input
          type="text"
          value={newMessage}
          onChange={handleTyping}
          placeholder="Type a message..."
          className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
        />
        <button type="submit" disabled={loading || !newMessage.trim()} className="w-10 h-10 bg-amber rounded-full flex items-center justify-center disabled:opacity-50">
          <Send size={16} className="text-white" />
        </button>
      </form>
    </div>
  );
}
