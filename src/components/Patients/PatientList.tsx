"use client";

import React, { useMemo } from "react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import { PatientRow, PatientListItem } from "@/app/recepcao/pacientes/patient-list-client";

export interface PatientListProps {
  items: PatientRow[];
  onInactivate?: (patient: PatientRow) => void;
  height?: number;
  itemSize?: number;
}

interface ItemDataPayload {
  items: PatientRow[];
  onInactivate?: (patient: PatientRow) => void;
}

const RowRenderer = React.memo(({ index, style, data }: ListChildComponentProps<ItemDataPayload>) => {
  const patient = data.items[index];
  if (!patient) return null;

  return (
    <div style={{ ...style, paddingBottom: "8px" }}>
      <PatientListItem
        patient={patient}
        onInactivate={data.onInactivate ?? (() => {})}
      />
    </div>
  );
});
RowRenderer.displayName = "RowRenderer";

/**
 * Componente PatientList utilizando react-window (FixedSizeList) e repasse otimizado via itemData
 * para suporte a alta volumetria com rolagem fluida a 60 FPS.
 */
export function PatientList({
  items,
  onInactivate,
  height = 600,
  itemSize = 72,
}: PatientListProps) {
  const itemData = useMemo<ItemDataPayload>(
    () => ({
      items,
      onInactivate,
    }),
    [items, onInactivate]
  );

  return (
    <div className="w-full rounded-lg border border-paper-line-strong bg-paper/30 p-1">
      <FixedSizeList
        height={height}
        itemCount={items.length}
        itemSize={itemSize}
        width="100%"
        itemData={itemData}
      >
        {RowRenderer}
      </FixedSizeList>
    </div>
  );
}

export default PatientList;
