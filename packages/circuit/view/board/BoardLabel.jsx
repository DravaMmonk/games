import { createContext, useContext } from 'react'
import { SettingsContext } from 'kernel/view'
import { numberAt } from '../../core/board/card-order.js'

/** A board can supply a renderer for the text on its cards and ports. */
export const BoardLabelContext = createContext(null)

export function useBoardNumber() {
  return useContext(SettingsContext).formatCardNumber ?? numberAt
}

export default function BoardLabel({ label }) {
  const Label = useContext(BoardLabelContext)
  return Label ? <Label label={label} /> : label
}
