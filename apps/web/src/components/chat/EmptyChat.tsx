export default function EmptyChat() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#222E35]">
      {/* WorkChat logo/icon */}
      <div className="mb-8">
        <svg
          className="w-[320px] h-[188px] text-[#364147]"
          viewBox="0 0 303 172"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M229.565 160.229C262.212 149.245 286.931 118.241 283.39 73.4194C278.009 5.31929 210.365 -13.0106 152.365 5.79457C117.169 17.1901 73.6997 36.2805 36.8368 48.5765C-7.15866 63.6401 -0.924371 118.885 47.6934 136.186C77.7909 147.093 113.618 157.574 152.062 159.932C172.247 161.177 196.867 171.217 229.565 160.229Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M131.589 68.9422C131.593 68.9422 131.596 68.9422 131.599 68.9422C137.86 68.9422 142.935 63.8667 142.935 57.6057C142.935 51.3446 137.86 46.2692 131.599 46.2692C131.596 46.2692 131.593 46.2692 131.589 46.2692C125.328 46.2692 120.253 51.3446 120.253 57.6057C120.253 63.8667 125.328 68.9422 131.589 68.9422Z"
            fill="#0B141A"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M176.464 68.9422C176.467 68.9422 176.471 68.9422 176.474 68.9422C182.735 68.9422 187.81 63.8667 187.81 57.6057C187.81 51.3446 182.735 46.2692 176.474 46.2692C176.471 46.2692 176.467 46.2692 176.464 46.2692C170.203 46.2692 165.128 51.3446 165.128 57.6057C165.128 63.8667 170.203 68.9422 176.464 68.9422Z"
            fill="#0B141A"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M154.041 90.6643C139.011 90.6643 131.589 98.0865 131.589 98.0865C131.589 98.0865 139.011 105.509 154.041 105.509C169.071 105.509 176.493 98.0865 176.493 98.0865C176.493 98.0865 169.071 90.6643 154.041 90.6643Z"
            fill="#0B141A"
          />
        </svg>
      </div>

      {/* Title and description */}
      <h1 className="text-[32px] font-light text-[#E9EDEF] mb-4">
        WorkChat Web
      </h1>
      <p className="text-[#8696A0] text-sm text-center max-w-md leading-6">
        Send and receive messages with your team. Task management built into every conversation.
      </p>

      {/* Divider */}
      <div className="flex items-center gap-4 mt-8 text-[#8696A0] text-sm">
        <div className="w-24 h-px bg-[#3B4A54]" />
        <span>Select a chat to start messaging</span>
        <div className="w-24 h-px bg-[#3B4A54]" />
      </div>

      {/* Features */}
      <div className="flex gap-8 mt-8">
        <FeatureCard
          icon={
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"/>
            </svg>
          }
          title="Real-time Chat"
          description="Message your team instantly"
        />
        <FeatureCard
          icon={
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          }
          title="Task Management"
          description="Convert messages to tasks"
        />
        <FeatureCard
          icon={
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          }
          title="Proof & Approval"
          description="Track completion with evidence"
        />
      </div>
    </div>
  )
}

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-[#00A884]/10 flex items-center justify-center text-[#00A884] mb-3">
        {icon}
      </div>
      <h3 className="text-[#E9EDEF] font-medium text-sm mb-1">{title}</h3>
      <p className="text-[#8696A0] text-xs">{description}</p>
    </div>
  )
}
