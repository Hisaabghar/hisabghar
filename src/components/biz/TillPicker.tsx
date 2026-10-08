import type { Till } from '../../types'
import { Segmented } from '../ui/kit'

export function TillPicker({ value, onChange }: { value: Till; onChange: (t: Till) => void }) {
  return (
    <Segmented
      options={[
        { id: 'cash', label: '💵 Cash' },
        { id: 'easypaisa', label: 'Easypaisa' },
        { id: 'jazzcash', label: 'JazzCash' },
      ]}
      value={value}
      onChange={onChange}
    />
  )
}
