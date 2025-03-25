'use client'

import { useChat } from '@ai-sdk/react'
import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat()
  
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const onSubmit = (e: { preventDefault?: () => void } | undefined) => {
    setIsTyping(true)
    Promise.resolve(handleSubmit(e)).finally(() => setIsTyping(false))
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="h-[60vh] overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
              <p className="mb-4">Ask questions about your speedrun games, categories, and records!</p>
              <div className="text-sm text-left bg-blue-50 border-l-4 border-blue-500 p-4 mx-auto max-w-md">
                <p className="font-medium mb-2">Example questions:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>What's my best time for Super Mario 64?</li>
                  <li>How far am I from the world record in Hollow Knight any%?</li>
                  <li>Which game has the most speedrun categories?</li>
                  <li>Show me all personal bests ordered by date</li>
                </ul>
              </div>
            </div>
          )}
          
          {messages.map(message => (
            <div key={message.id} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <span 
                className={`inline-block p-2 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-black'
                }`}
              >
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return <div key={`${message.id}-${i}`}>{part.text}</div>;
                  }
                })}
              </span>
            </div>
          ))}
          
          {isTyping && (
            <div className="text-left">
              <span className="inline-block p-2 rounded-lg bg-gray-200 text-black">
                <span className="inline-block w-2 h-4 bg-gray-500 animate-pulse">&nbsp;</span>
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </CardContent>
        <CardFooter>
          <form onSubmit={onSubmit} className="flex w-full space-x-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Say something..."
              className="flex-grow"
            />
            <Button type="submit" disabled={isTyping}>Send</Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}