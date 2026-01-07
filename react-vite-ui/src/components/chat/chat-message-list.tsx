import { ScrollArea } from "@/components/ui/scroll-area";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChatMessageListProps {
  children: ReactNode;
  className?: string;
}

export const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ children, className }, ref) => {
    return (
      <ScrollArea className={cn("h-full", className)} type="always">
        <div className="flex flex-col w-full p-4 gap-4" ref={ref}>
          {children}
        </div>
      </ScrollArea>
    );
  }
);

ChatMessageList.displayName = "ChatMessageList";
