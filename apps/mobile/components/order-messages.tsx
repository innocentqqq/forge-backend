import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { api } from '../lib/api';
import { fonts } from '../lib/fonts';
import type { OrderMessage, OrderMessageRole } from '../lib/types';
import { colors, radius, shadow } from '../lib/theme';
import { Banner, Button, EmptyView, LoadingView, TextField } from './ui';

const POLL_INTERVAL_MS = 5000;

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Shared per-order chat thread for customer tracking and provider job screens. */
export function OrderMessages({
  orderId,
  viewerRole,
}: {
  orderId: string;
  viewerRole: OrderMessageRole;
}) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api.getOrderMessages(orderId);
      setMessages(result);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const message = await api.sendOrderMessage(orderId, draft, viewerRole);
      setMessages((current) => [...current, message]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the message');
    } finally {
      setSending(false);
    }
  };

  const renderMessage: ListRenderItem<OrderMessage> = ({ item }) => {
    const mine = item.senderRole === viewerRole;
    return (
      <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
        <View style={[styles.bubble, mine && styles.bubbleMine]}>
          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
          <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {error ? <Banner message={error} /> : null}
      {loading ? (
        <LoadingView label="Loading messages…" />
      ) : messages.length === 0 ? (
        <EmptyView
          title="No messages yet"
          message="Send a note about the print, pickup time, or anything the other party should know."
        />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => undefined}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.composer}>
        <TextField
          label="Message"
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Write a message…"
          style={styles.input}
        />
        <Button
          title="Send"
          onPress={() => void send()}
          loading={sending}
          disabled={!draft.trim()}
          size="sm"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 360,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
    ...shadow.card,
  },
  list: { gap: 8, paddingBottom: 6 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: { backgroundColor: colors.accentSoft },
  bubbleText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  bubbleTextMine: { color: colors.text },
  bubbleTime: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, marginTop: 4 },
  bubbleTimeMine: { color: colors.muted },
  composer: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  input: { minHeight: 64, textAlignVertical: 'top' },
});
