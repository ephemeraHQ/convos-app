import { memo } from "react"
import { IListItemProps, ListItem } from "@/design-system/list-item"

export const GroupDetailsListItem = memo(function GroupDetailsListItem(props: IListItemProps) {
  const { style, ...rest } = props

  return <ListItem style={[{}, style]} {...rest} />
})
