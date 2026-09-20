"use client";

import {
  ConversationList as VirtualizedConversationList,
  ConversationListProps,
} from "@/src/components/Reception/Chat/ConversationList";
import { ConversationFilter } from "@/src/components/Reception/Navigation/SubNavBadges";

export type { ConversationFilter };

export function ConversationList(props: ConversationListProps) {
  return <VirtualizedConversationList {...props} />;
}
