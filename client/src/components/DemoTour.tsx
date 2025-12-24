import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    title: 'Welcome to Demo Mode',
    description: 'This is a guided tour showing you the key features of the Target Account Dashboard. Click Next to continue.',
    position: 'bottom',
  },
  {
    title: 'Dashboard Stats',
    description: 'These cards show your key metrics: Total Accounts, Hot Leads (Intent 70+), Warm Leads, and 6QA Opportunity Gap.',
    target: 'stats-section',
    position: 'bottom',
  },
  {
    title: 'Priority Actions',
    description: 'Your top 3 accounts requiring immediate attention, ranked by VECTOR score and intent. Each shows why you should engage now.',
    target: 'priority-actions',
    position: 'bottom',
  },
  {
    title: 'VECTOR Score',
    description: 'Our proprietary scoring algorithm (0-100) combines engagement, intent, and company signals. Higher scores = more ready to buy.',
    target: 'vector-score',
    position: 'right',
  },
  {
    title: 'Top Accounts by Region',
    description: 'View your highest-intent accounts organized by region and assigned AE. Click "View All" to see the complete list.',
    target: 'top-accounts',
    position: 'top',
  },
  {
    title: 'AI Chat Assistant',
    description: 'Ask questions about your accounts, get insights, and generate outreach emails powered by AI. Try asking "What should I prioritize?"',
    target: 'ai-chat',
    position: 'left',
  },
  {
    title: 'You\'re all set!',
    description: 'Explore the dashboard, click on accounts to see details, and use AI Chat for insights. Happy selling!',
    position: 'bottom',
  },
];

export function DemoTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  useEffect(() => {
    // Check if user has seen tour before
    const seen = localStorage.getItem('demo-tour-seen');
    if (!seen) {
      // Delay showing tour to let page load
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setHasSeenTour(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      closeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const closeTour = () => {
    setIsVisible(false);
    localStorage.setItem('demo-tour-seen', 'true');
  };

  if (!isVisible || hasSeenTour) return null;

  const step = tourSteps[currentStep];
  const targetElement = step.target ? document.getElementById(step.target) : null;
  const rect = targetElement?.getBoundingClientRect();

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: '16px',
    borderRadius: '8px',
    maxWidth: '320px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    border: '2px solid #7c3aed',
  };

  // Position tooltip based on target element
  if (rect) {
    const offset = 16;
    switch (step.position) {
      case 'top':
        tooltipStyle.left = rect.left + rect.width / 2 - 160;
        tooltipStyle.top = rect.top - 180;
        break;
      case 'bottom':
        tooltipStyle.left = rect.left + rect.width / 2 - 160;
        tooltipStyle.top = rect.bottom + offset;
        break;
      case 'left':
        tooltipStyle.left = rect.left - 340;
        tooltipStyle.top = rect.top + rect.height / 2 - 60;
        break;
      case 'right':
        tooltipStyle.left = rect.right + offset;
        tooltipStyle.top = rect.top + rect.height / 2 - 60;
        break;
    }
  } else {
    // Center on screen if no target
    tooltipStyle.left = '50%';
    tooltipStyle.top = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <>
      {/* Overlay */}
      {targetElement && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9998,
          }}
          onClick={closeTour}
        />
      )}

      {/* Highlight box */}
      {targetElement && (
        <div
          style={{
            position: 'fixed',
            top: rect!.top - 4,
            left: rect!.left - 4,
            width: rect!.width + 8,
            height: rect!.height + 8,
            border: '3px solid #7c3aed',
            borderRadius: '8px',
            zIndex: 9998,
            boxShadow: '0 0 20px rgba(124, 58, 237, 0.5)',
          }}
        />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-bold text-lg">{step.title}</h3>
          <button
            onClick={closeTour}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-300 mb-4">{step.description}</p>

        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Step {currentStep + 1} of {tourSteps.length}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft size={16} />
              Prev
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1 bg-purple-600 hover:bg-purple-700"
            >
              {currentStep === tourSteps.length - 1 ? 'Done' : 'Next'}
              {currentStep < tourSteps.length - 1 && <ChevronRight size={16} />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
