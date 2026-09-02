import { useState } from 'react';
import Welcome from './pages/Welcome';
import Questions from './pages/Questions';
import Recommendations from './pages/Recommendations';
import TryOn from './pages/TryOn';
import Chat from './pages/Chat';
import Checkout from './pages/Checkout';

export type Page = 
  | 'welcome'
  | 'questions'
  | 'recommendations'
  | 'tryon'
  | 'chat'
  | 'checkout';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');

  const navigateTo = (page: Page) => setCurrentPage(page);

  return (
    <div className="app">
      {currentPage === 'welcome' && (
        <Welcome onNext={() => navigateTo('questions')} />
      )}
      {currentPage === 'questions' && (
        <Questions onNext={() => navigateTo('recommendations')} />
      )}
      {currentPage === 'recommendations' && (
        <Recommendations
          onNext={() => navigateTo('tryon')}
          onChat={() => navigateTo('chat')}
        />
      )}
      {currentPage === 'tryon' && (
        <TryOn
          onNext={() => navigateTo('chat')}
          onBack={() => navigateTo('recommendations')}
        />
      )}
      {currentPage === 'chat' && (
        <Chat
          onDecide={() => navigateTo('checkout')}
          onBack={() => navigateTo('recommendations')}
        />
      )}
      {currentPage === 'checkout' && (
        <Checkout onReset={() => navigateTo('welcome')} />
      )}
    </div>
  );
}