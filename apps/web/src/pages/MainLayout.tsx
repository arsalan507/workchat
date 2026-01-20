import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import ChatPanel from '../components/chat/ChatPanel'
import EmptyChat from '../components/chat/EmptyChat'
import TasksPanel from '../components/tasks/TasksPanel'

export type ActiveTab = 'chats' | 'tasks'

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chats')

  return (
    <div className="h-screen flex">
      {/* Left Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Right Panel - Chat/Tasks area */}
      <div className="flex-1 flex flex-col bg-[#222E35]">
        {activeTab === 'chats' ? (
          <Routes>
            <Route path="/" element={<EmptyChat />} />
            <Route path="/chat/:chatId" element={<ChatPanel />} />
          </Routes>
        ) : (
          <TasksPanel />
        )}
      </div>
    </div>
  )
}
