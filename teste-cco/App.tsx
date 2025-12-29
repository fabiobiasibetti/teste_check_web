
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
// Fixed: Added ChevronRight, ChevronLeft, and LogOut to the lucide-react imports
import { CheckSquare, History, Truck, Moon, Sun, Loader2, RefreshCw, CloudCheck, CloudOff, ChevronRight, ChevronLeft, LogOut } from 'lucide-react';
import TaskManager from './components/TaskManager';
import HistoryViewer from './components/HistoryViewer';
import RouteDepartureView from './components/RouteDeparture';
import Login from './components/Login';
import { SharePointService } from './services/sharepointService';
import { Task, User, OperationStatus } from './types';
import { setCurrentUser as setStorageUser } from './services/storageService';

const SidebarLink = ({ to, icon: Icon, label, active, collapsed }: any) => (
  <a href={`#${to}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'} ${collapsed ? 'justify-center' : ''}`}>
    <Icon size={20} />
    {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
  </a>
);

const AppContent = () => {
  const [currentUser, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  // Fixed: Added state for collapsedCategories which was being passed but not defined
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
  
  // MAPA DE VERDADE LOCAL: { "taskId-location": "status_que_eu_cliquei" }
  // Só removemos daqui quando a nuvem devolver o MESMO valor.
  const pendingSyncRef = useRef<Record<string, OperationStatus>>({});
  const lastListTimestampRef = useRef<string | null>(null);
  const navigate = useNavigate();

  const loadDataFromSharePoint = async (user: User) => {
    if (!user.accessToken) return;
    (window as any).__access_token = user.accessToken; 
    setIsLoading(true);
    try {
      const spTasks = await SharePointService.getTasks(user.accessToken);
      const spOps = await SharePointService.getOperations(user.accessToken, user.email);
      const today = new Date().toISOString().split('T')[0];
      const spStatus = await SharePointService.getStatusByDate(user.accessToken, today);

      const meta = await SharePointService.getListMetadata(user.accessToken, 'Status_Checklist');
      lastListTimestampRef.current = meta.lastModifiedDateTime;

      const opSiglas = spOps.map(o => o.Title);
      setLocations(opSiglas);

      const matrixTasks: Task[] = spTasks.map(t => {
        const ops: Record<string, any> = {};
        opSiglas.forEach(sigla => {
          const statusMatch = spStatus.find(s => s.TarefaID === t.id && s.OperacaoSigla === sigla);
          ops[sigla] = statusMatch ? statusMatch.Status : 'PR';
        });

        return {
          id: t.id,
          title: t.Title,
          description: t.Descricao,
          category: t.Categoria,
          timeRange: t.Horario,
          operations: ops,
          createdAt: new Date().toISOString(),
          isDaily: true,
          active: t.Ativa
        };
      });

      setTasks(matrixTasks.filter(t => t.active !== false));
    } catch (err) {
      console.error("Erro ao carregar SharePoint:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // LÓGICA DE SINCRONIZAÇÃO À PROVA DE ERROS
  useEffect(() => {
    if (!currentUser?.accessToken || isLoading) return;

    const syncInterval = setInterval(async () => {
      if (isSyncing) return;

      try {
        const meta = await SharePointService.getListMetadata(currentUser.accessToken!, 'Status_Checklist');
        
        // Só processa se houver mudança real na lista do SharePoint
        if (meta.lastModifiedDateTime !== lastListTimestampRef.current) {
          setIsSyncing(true);
          const today = new Date().toISOString().split('T')[0];
          const cloudStatusList = await SharePointService.getStatusByDate(currentUser.accessToken!, today);
          
          setTasks(prevTasks => {
            let hasGlobalChanges = false;
            const nextTasks = prevTasks.map(task => {
              const updatedOps = { ...task.operations };
              let taskChanged = false;

              locations.forEach(sigla => {
                const cellKey = `${task.id}-${sigla}`;
                const cloudMatch = cloudStatusList.find(s => s.TarefaID === task.id && s.OperacaoSigla === sigla);
                const cloudValue = cloudMatch ? cloudMatch.Status : 'PR';
                const pendingValue = pendingSyncRef.current[cellKey];

                // SE TEM VALOR PENDENTE LOCAL
                if (pendingValue !== undefined) {
                  // Se a nuvem já igualou o que eu cliquei, libero a trava
                  if (cloudValue === pendingValue) {
                    delete pendingSyncRef.current[cellKey];
                  } else {
                    // Ignora o valor da nuvem (PR) e mantém o que eu cliquei (OK)
                    if (updatedOps[sigla] !== pendingValue) {
                      updatedOps[sigla] = pendingValue;
                      taskChanged = true;
                    }
                    return; // Pula para a próxima iteração
                  }
                }

                // Sincronização Normal (Sem pendências locais)
                if (updatedOps[sigla] !== cloudValue) {
                  updatedOps[sigla] = cloudValue;
                  taskChanged = true;
                }
              });

              if (taskChanged) hasGlobalChanges = true;
              return taskChanged ? { ...task, operations: updatedOps } : task;
            });

            return hasGlobalChanges ? nextTasks : prevTasks;
          });
          
          lastListTimestampRef.current = meta.lastModifiedDateTime;
          setIsSyncing(false);
        }
      } catch (e) {
        setIsSyncing(false);
      }
    }, 5000); 

    return () => clearInterval(syncInterval);
  }, [currentUser, isLoading, isSyncing, locations]);

  // Função disparada pelo TaskManager ao clicar/editar
  const handleCellInteraction = useCallback((taskId: string, location: string, status: OperationStatus) => {
    const cellKey = `${taskId}-${location}`;
    pendingSyncRef.current[cellKey] = status;
  }, []);

  const handleLogout = () => {
    setUser(null);
    setStorageUser(null);
    delete (window as any).__access_token;
    localStorage.clear(); 
    sessionStorage.clear();
    navigate('/');
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  if (!currentUser) return <Login onLogin={(u) => { setUser(u); loadDataFromSharePoint(u); }} />;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <aside className={`bg-white dark:bg-slate-900 border-r dark:border-slate-800 transition-all ${collapsed ? 'w-20' : 'w-64'} p-4 flex flex-col`}>
        <div className="mb-10 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">V</div>
          {!collapsed && <h1 className="font-bold dark:text-white text-sm">CCO Digital</h1>}
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarLink to="/" icon={CheckSquare} label="Checklist" active={window.location.hash === '#/'} collapsed={collapsed} />
          <SidebarLink to="/departures" icon={Truck} label="Saídas" active={window.location.hash === '#/departures'} collapsed={collapsed} />
          <SidebarLink to="/history" icon={History} label="Histórico" active={window.location.hash === '#/history'} collapsed={collapsed} />
        </nav>
        
        <div className="mt-auto mb-4 p-2 rounded-lg flex items-center justify-center gap-2">
            {isSyncing ? (
              <RefreshCw size={14} className="text-blue-500 animate-spin" />
            ) : (
              <CloudCheck size={14} className="text-green-500" />
            )}
            {!collapsed && (
              <span className="text-[10px] font-bold uppercase text-slate-400">
                {isSyncing ? 'Sincronizando' : 'Nuvem OK'}
              </span>
            )}
        </div>

        <div className="space-y-2 border-t pt-4 dark:border-slate-800">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 w-full flex justify-center text-slate-500 hover:bg-slate-100 rounded-lg">
             {isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}
           </button>
           <button onClick={() => setCollapsed(!collapsed)} className="p-2 w-full flex justify-center text-slate-500 hover:bg-slate-100 rounded-lg">
             {collapsed ? <ChevronRight size={20}/> : <ChevronLeft size={20}/>}
           </button>
           <button onClick={handleLogout} className="p-2 w-full flex justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
             <LogOut size={20}/>
           </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden p-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center flex-col gap-4 text-blue-600">
             <Loader2 size={40} className="animate-spin" />
             <p className="font-bold animate-pulse">Estabelecendo conexão segura...</p>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={
              <TaskManager 
                tasks={tasks} 
                setTasks={setTasks} 
                locations={locations} 
                setLocations={setLocations} 
                onUserSwitch={() => loadDataFromSharePoint(currentUser)} 
                collapsedCategories={collapsedCategories} 
                setCollapsedCategories={setCollapsedCategories} 
                currentUser={currentUser}
                onLogout={handleLogout}
                onInteractionStart={handleCellInteraction}
              />
            } />
            <Route path="/departures" element={<RouteDepartureView />} />
            <Route path="/history" element={<HistoryViewer currentUser={currentUser} />} />
          </Routes>
        )}
      </main>
    </div>
  );
};

const App = () => (<Router><AppContent /></Router>);
export default App;
