import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Badge, Button } from '@/components/ui';
import { useRelationStatus } from '@/hooks/useProfile';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from '@/lib/friend-actions';

type Props = {
  targetUserId: string;
};

export function FriendActionButton({ targetUserId }: Props) {
  const qc = useQueryClient();
  const { data: relation, isLoading } = useRelationStatus(targetUserId);
  const [pending, setPending] = useState(false);

  if (isLoading || !relation) return null;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['relation-status', targetUserId] });

  const withPending = async (fn: () => Promise<{ ok: boolean; error: string | null }>) => {
    setPending(true);
    const r = await fn();
    setPending(false);
    if (!r.ok) Alert.alert('Error', r.error ?? 'No pudimos completar la acción');
    else invalidate();
  };

  switch (relation.kind) {
    case 'self':
      return null;
    case 'none':
      return (
        <Button
          label="Enviar solicitud"
          onPress={() => withPending(() => sendFriendRequest(targetUserId))}
          loading={pending}
        />
      );
    case 'outgoing_pending':
      return (
        <Button
          label="Cancelar solicitud"
          variant="secondary"
          onPress={() => withPending(() => cancelFriendRequest(relation.requestId))}
          loading={pending}
        />
      );
    case 'incoming_pending':
      return (
        <View className="gap-2">
          <Button
            label="Aceptar solicitud"
            onPress={() => withPending(() => acceptFriendRequest(relation.requestId))}
            loading={pending}
          />
          <Button
            label="Rechazar"
            variant="secondary"
            onPress={() => withPending(() => rejectFriendRequest(relation.requestId))}
            loading={pending}
          />
        </View>
      );
    case 'friends':
      return (
        <View className="items-center gap-3">
          <Badge label="Amigos" variant="success" />
          <Button
            label="Quitar de amigos"
            variant="danger"
            fullWidth={false}
            onPress={() =>
              Alert.alert('Quitar de amigos', '¿Seguro que querés quitar a esta persona de tu lista?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Quitar',
                  style: 'destructive',
                  onPress: () => void withPending(() => removeFriend(targetUserId)),
                },
              ])
            }
            loading={pending}
          />
        </View>
      );
  }
}
