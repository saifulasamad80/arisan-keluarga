import { Pencil, Trash2 } from 'lucide-react'
import { Button } from './ui/button'

export function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onEdit}><Pencil size={16} /> Ubah</Button>
      <Button type="button" size="sm" variant="outline" className="border-rose-400 text-rose-800 hover:bg-rose-50" onClick={onDelete}><Trash2 size={16} /> Hapus</Button>
    </div>
  )
}
