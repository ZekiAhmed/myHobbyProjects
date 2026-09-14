import Link from "next/link";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Users, ListTodo } from "lucide-react";

type ListCardProps = {
  list: {
    id: string;
    name: string;
    memberCount: number;
    openTodoCount: number;
  };
};

export function ListCard({ list }: ListCardProps) {
  return (
    <Link href={`/lists/${list.id}`} className="block group">
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
        <CardContent>
          <CardTitle className="mb-2">{list.name}</CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {list.memberCount} member{list.memberCount === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1">
              <ListTodo className="size-3.5" />
              {list.openTodoCount} open
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
