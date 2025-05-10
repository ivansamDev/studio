
"use client";

import type { NextComponentType } from 'next';
import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { callChatAgentAction } from '@/app/actions';
import type { ChatWithMarkdownInput } from '@/ai/flows/chat-with-markdown-flow';
import { cn } from '@/lib/utils';

interface FloatingChatProps {
  markdownContent: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export const FloatingChat: NextComponentType<{}, {}, FloatingChatProps> = ({ markdownContent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);
  
  useEffect(() => {
    // When chat opens with no messages, add a default greeting from AI
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: Date.now().toString() + '_ai_greeting',
          role: 'ai',
          text: markdownContent 
            ? "Hello! I'm ready to discuss the Markdown content you've fetched. Ask me anything about it!"
            : "Hello! I'm your AI assistant. Fetch some Markdown content or ask me general questions.",
          timestamp: new Date(),
        }
      ]);
    }
  }, [isOpen, markdownContent, messages.length]);


  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue('');
    setIsLoading(true);

    const historyForAI: ChatWithMarkdownInput['chatHistory'] = messages
      .map((msg) => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      }));
    
    // The current user message is not yet in `messages` when `historyForAI` is constructed,
    // so we add it here before sending.
    historyForAI.push({ role: 'user', parts: [{ text: newUserMessage.text }] });


    try {
      const response = await callChatAgentAction({
        userQuery: newUserMessage.text,
        markdownContent: markdownContent,
        // Send history *before* the current user message for the AI
        chatHistory: historyForAI.slice(0, -1), 
      });

      if (response.agentResponse) {
        const newAiMessage: Message = {
          id: Date.now().toString() + '_ai',
          role: 'ai',
          text: response.agentResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newAiMessage]);
      } else if (response.error) {
        const errorAiMessage: Message = {
          id: Date.now().toString() + '_err',
          role: 'ai',
          text: `Sorry, I encountered an error: ${response.error}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorAiMessage]);
      }
    } catch (error) {
      const errorAiMessage: Message = {
        id: Date.now().toString() + '_fetch_err',
        role: 'ai',
        text: 'Sorry, I could not reach the assistant at the moment.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorAiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <Button
          className="fixed bottom-6 right-6 z-50 rounded-full w-16 h-16 shadow-lg flex items-center justify-center"
          size="icon"
          onClick={() => setIsOpen(true)}
          aria-label="Open chat"
        >
          <MessageSquare className="h-7 w-7" />
        </Button>
      )}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 z-[100] w-[350px] sm:w-[400px] h-[calc(100vh-100px)] max-h-[600px] shadow-xl flex flex-col rounded-lg border bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
            <CardTitle className="text-lg font-semibold">AI Assistant</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close chat">
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-end space-x-2",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'ai' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback><Bot size={18}/></AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    <p style={{whiteSpace: "pre-wrap"}}>{msg.text}</p>
                     <p className={cn(
                        "text-xs mt-1",
                        msg.role === 'user' ? "text-primary-foreground/70 text-right" : "text-secondary-foreground/70 text-left"
                      )}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                  </div>
                  {msg.role === 'user' && (
                     <Avatar className="h-8 w-8">
                      <AvatarFallback><User size={18}/></AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                 <div className="flex items-end space-x-2 justify-start">
                    <Avatar className="h-8 w-8">
                       <AvatarFallback><Bot size={18}/></AvatarFallback>
                    </Avatar>
                    <div className="max-w-[75%] rounded-lg px-3 py-2 text-sm bg-secondary text-secondary-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                 </div>
              )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-3 border-t sticky bottom-0 bg-card z-10">
            <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
              <Input
                type="text"
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className="flex-grow bg-background focus:ring-primary"
              />
              <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()} aria-label="Send message">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
};
