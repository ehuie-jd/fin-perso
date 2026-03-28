import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, ArrowUpRight, ArrowDownRight, CreditCard, PieChart as PieChartIcon, 
  Target, AlertCircle, Plus, Download, Wallet, CheckCircle2, TrendingUp, 
  Activity, Trash2, PlusCircle, Settings, X, RefreshCw
} from 'lucide-react';

// --- CONFIGURATION GOOGLE SHEETS ---
// Colle ici l'URL de ton application Web générée par Google Apps Script
// Exemple : "https://script.google.com/macros/s/AKfycbx_TON_URL_SECRETE/exec"

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxbfQhC4lnkUzqieUT8C0eDzAHhc-ltByjOYknrz67Wk9R9uHC4KX_ZZv19Hnve5399/exec"; 

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // --- ÉTATS DES DONNÉES (Sauvegarde 100% Locale) ---
  const [budgetLimit, setBudgetLimit] = useState(() => parseFloat(localStorage.getItem('finpro_budget')) || 150000);
  const [transactions, setTransactions] = useState(() => JSON.parse(localStorage.getItem('finpro_tx')) || []);
  const [debts, setDebts] = useState(() => JSON.parse(localStorage.getItem('finpro_debts')) || []);
  const [goals, setGoals] = useState(() => JSON.parse(localStorage.getItem('finpro_goals')) || []);

  // Synchronisation avec le stockage local à chaque changement
  useEffect(() => { localStorage.setItem('finpro_budget', budgetLimit.toString()); }, [budgetLimit]);
  useEffect(() => { localStorage.setItem('finpro_tx', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('finpro_debts', JSON.stringify(debts)); }, [debts]);
  useEffect(() => { localStorage.setItem('finpro_goals', JSON.stringify(goals)); }, [goals]);

  // --- ÉTATS DES MODALES ---
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ type: 'expense', amount: '', category: 'Alimentation', date: new Date().toISOString().split('T')[0], description: '' });
  
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [newDebt, setNewDebt] = useState({ name: '', totalAmount: '' });
  
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', targetAmount: '' });

  const [amountModal, setAmountModal] = useState(null);
  const [amountInput, setAmountInput] = useState('');
  
  // État pour afficher si la synchro vers Google Sheets est en cours
  const [syncStatus, setSyncStatus] = useState('');

  // --- CALCULS AUTOMATIQUES ---
  const { totalIncome, totalExpenses, balance, expensesByCategory } = useMemo(() => {
    let income = 0; let expenses = 0; const categories = {};
    transactions.forEach(t => {
      const amount = parseFloat(t.amount);
      if (t.type === 'income') { income += amount; } 
      else {
        expenses += amount;
        categories[t.category] = (categories[t.category] || 0) + amount;
      }
    });
    return {
      totalIncome: income, totalExpenses: expenses, balance: income - expenses,
      expensesByCategory: Object.entries(categories).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    };
  }, [transactions]);

  const { totalDebts, remainingDebts } = useMemo(() => {
    return debts.reduce((acc, debt) => {
      acc.totalDebts += parseFloat(debt.totalAmount);
      acc.remainingDebts += (parseFloat(debt.totalAmount) - parseFloat(debt.paidAmount));
      return acc;
    }, { totalDebts: 0, remainingDebts: 0 });
  }, [debts]);

  const maxExpenseCategory = expensesByCategory.length > 0 ? expensesByCategory[0].value : 1;

  // --- ENVOI VERS GOOGLE SHEETS ---
  const sendToGoogleSheets = (sheetName, data) => {
    if (!GOOGLE_SHEETS_URL) return;
    
    setSyncStatus('syncing');
    
    // Le mode 'no-cors' permet d'envoyer la requête silencieusement sans être bloqué par les sécurités du navigateur
    fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheetName, data: data })
    })
    .then(() => {
      setSyncStatus('success');
      setTimeout(() => setSyncStatus(''), 3000); // Efface le message après 3 secondes
    })
    .catch((err) => {
      console.error("Erreur d'envoi vers Google Sheets :", err);
      setSyncStatus('error');
    });
  };

  // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!newTransaction.amount) return;
    
    const txData = { 
      id: Date.now().toString(), 
      ...newTransaction, 
      amount: parseFloat(newTransaction.amount), 
      createdAt: new Date().toISOString() 
    };
    
    // 1. Sauvegarde locale pour affichage immédiat
    setTransactions(prev => [txData, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
    
    // 2. Envoi silencieux vers Google Sheets
    sendToGoogleSheets('Transactions', txData);
    
    setShowTransactionModal(false);
    setNewTransaction({ type: 'expense', amount: '', category: 'Alimentation', date: new Date().toISOString().split('T')[0], description: '' });
  };

  const handleDeleteTransaction = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    // Note : La suppression dans Google Sheets nécessite une logique plus complexe dans Apps Script, 
    // on se contente de la suppression locale ici pour garder l'API simple.
  };

  const handleAddDebt = (e) => {
    e.preventDefault();
    if (!newDebt.name || !newDebt.totalAmount) return;
    const debtData = { id: Date.now().toString(), name: newDebt.name, totalAmount: parseFloat(newDebt.totalAmount), paidAmount: 0, createdAt: new Date().toISOString() };
    setDebts(prev => [...prev, debtData]);
    setShowDebtModal(false); setNewDebt({ name: '', totalAmount: '' });
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!newGoal.name || !newGoal.targetAmount) return;
    const goalData = { id: Date.now().toString(), name: newGoal.name, targetAmount: parseFloat(newGoal.targetAmount), savedAmount: 0, createdAt: new Date().toISOString() };
    setGoals(prev => [...prev, goalData]);
    setShowGoalModal(false); setNewGoal({ name: '', targetAmount: '' });
  };

  const handleAddAmount = (e) => {
    e.preventDefault();
    if (!amountInput || isNaN(amountInput)) return;
    const amount = parseFloat(amountInput);

    if (amountModal.type === 'debt') {
      setDebts(prev => prev.map(d => d.id === amountModal.id ? { ...d, paidAmount: d.paidAmount + amount } : d));
    } else {
      setGoals(prev => prev.map(g => g.id === amountModal.id ? { ...g, savedAmount: g.savedAmount + amount } : g));
    }
    setAmountModal(null); setAmountInput('');
  };

  const handleUpdateBudget = (e) => {
    const val = parseFloat(e.target.value);
    setBudgetLimit(val || 0);
  };

  const exportData = () => {
    const data = JSON.stringify({ transactions, debts, goals, budgetLimit }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `finance_export_${new Date().toISOString().split('T')[0]}.json`; a.click();
  };

  // --- COMPOSANTS UI ---
  const formatMoney = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(amount);

  const NavItem = ({ id, icon: Icon, label }) => (
    <button onClick={() => setActiveTab(id)} className={`flex items-center space-x-2 w-full p-3 rounded-lg transition-colors ${activeTab === id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}>
      <Icon size={20} /> <span className="font-medium hidden md:block">{label}</span>
    </button>
  );

  const mobileNavItems = [
    { id: 'dashboard', icon: Home, label: 'Accueil' },
    { id: 'transactions', icon: Wallet, label: 'Historique' },
    { id: 'debts', icon: CreditCard, label: 'Dettes' },
    { id: 'goals', icon: Target, label: 'Budget' }
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-4 shadow-sm z-10">
        <div className="flex items-center space-x-3 mb-8 px-2">
          <div className="bg-emerald-500 p-2 rounded-lg text-white"><Activity size={24} /></div>
          <h1 className="text-2xl font-bold text-slate-800">Finance<span className="text-blue-600">Pro</span></h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          <NavItem id="dashboard" icon={Home} label="Tableau de bord" />
          <NavItem id="transactions" icon={Wallet} label="Transactions" />
          <NavItem id="debts" icon={CreditCard} label="Dettes & Emprunts" />
          <NavItem id="goals" icon={Target} label="Objectifs & Budget" />
          <NavItem id="reports" icon={PieChartIcon} label="Rapports" />
        </nav>

        {/* Indicateur Google Sheets */}
        {!GOOGLE_SHEETS_URL ? (
          <div className="mx-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            <AlertCircle size={16} className="mb-1 inline-block mr-1"/> 
            Lien Google Sheets manquant. Données locales uniquement.
          </div>
        ) : (
          <div className="mx-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-center">
            {syncStatus === 'syncing' ? <RefreshCw size={16} className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2 text-emerald-500" />}
            {syncStatus === 'syncing' ? 'Envoi vers Sheets...' : 'Connecté à Sheets'}
          </div>
        )}

        <button onClick={exportData} className="flex items-center space-x-2 text-slate-500 hover:text-blue-600 p-3 mt-auto border-t border-slate-100">
          <Download size={18} /> <span className="font-medium">Exporter données (JSON)</span>
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative">
        {/* Header Mobile */}
        <div className="md:hidden bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <Activity className="text-emerald-500" size={24} />
            <h1 className="text-xl font-bold text-slate-800">Finance<span className="text-blue-600">Pro</span></h1>
          </div>
          <div className="flex items-center space-x-2">
            {syncStatus === 'syncing' && <RefreshCw size={18} className="animate-spin text-blue-500 mr-2" />}
            <button onClick={() => setShowTransactionModal(true)} className="bg-blue-600 text-white p-2.5 rounded-full shadow-md">
              <Plus size={20} />
            </button>
          </div>
        </div>

        {!GOOGLE_SHEETS_URL && (
          <div className="md:hidden bg-amber-50 p-2 text-center text-xs text-amber-700 font-medium">
            Mode hors-ligne : Données sur ce téléphone uniquement.
          </div>
        )}

        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
          
          <div className="hidden md:flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-slate-800 capitalize">{activeTab === 'dashboard' ? 'Vue d\'ensemble' : activeTab}</h2>
            <button onClick={() => setShowTransactionModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-md flex items-center space-x-2 transition-colors">
              <Plus size={20} /> <span className="font-medium">Nouvelle Opération</span>
            </button>
          </div>

          {/* --- VUE: TABLEAU DE BORD --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {balance < 10000 && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg flex items-start space-x-3">
                  <AlertCircle className="text-rose-500 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-rose-800 font-semibold">Alerte Solde Faible</h3>
                    <p className="text-rose-600 text-sm">Votre solde disponible est bas. Attention à vos prochaines dépenses.</p>
                  </div>
                </div>
              )}
              {totalExpenses > budgetLimit && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg flex items-start space-x-3">
                  <AlertCircle className="text-amber-500 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-amber-800 font-semibold">Dépassement de Budget</h3>
                    <p className="text-amber-600 text-sm">Vos dépenses ont dépassé votre limite de {formatMoney(budgetLimit)}.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                  <p className="text-blue-100 font-medium mb-1 relative z-10">Solde Total Disponible</p>
                  <h3 className="text-3xl md:text-4xl font-bold relative z-10">{formatMoney(balance)}</h3>
                  <Activity size={100} className="absolute right-[-20px] bottom-[-20px] text-blue-500 opacity-20" />
                </div>
                
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
                  <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600"><ArrowUpRight size={24} /></div>
                  <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Entrées (Revenus)</p>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800">{formatMoney(totalIncome)}</h3>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
                  <div className="bg-rose-100 p-3 rounded-2xl text-rose-600"><ArrowDownRight size={24} /></div>
                  <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Sorties (Dépenses)</p>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800">{formatMoney(totalExpenses)}</h3>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><PieChartIcon className="mr-2 text-blue-500" size={20} /> Dépenses par catégorie</h3>
                  <div className="space-y-5">
                    {expensesByCategory.length === 0 ? <p className="text-slate-500 text-center py-4">Aucune dépense enregistrée.</p> : expensesByCategory.map((item, index) => (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-1"><span className="font-medium text-slate-700">{item.name}</span><span className="text-slate-500">{formatMoney(item.value)}</span></div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${(item.value / maxExpenseCategory) * 100}%` }}></div></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><TrendingUp className="mr-2 text-emerald-500" size={20} /> Opérations récentes</h3>
                  <div className="space-y-4">
                    {transactions.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">Commencez par ajouter une opération.</p>
                    ) : (
                      transactions.slice(0, 5).map(t => (
                        <div key={t.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-xl ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              {t.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                            </div>
                            <div><p className="font-semibold text-slate-800 text-sm">{t.description}</p><p className="text-xs text-slate-500">{t.category} • {t.date}</p></div>
                          </div>
                          <span className={`font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'} text-sm`}>
                            {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  {transactions.length > 0 && (
                    <button onClick={() => setActiveTab('transactions')} className="w-full mt-4 py-3 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-xl transition-colors">Voir tout l'historique</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- VUE: TRANSACTIONS --- */}
          {activeTab === 'transactions' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Historique complet</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Description</th>
                      <th className="p-4 font-medium">Catégorie</th>
                      <th className="p-4 font-medium text-right">Montant</th>
                      <th className="p-4 font-medium text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.length === 0 ? (
                      <tr><td colSpan="5" className="p-8 text-center text-slate-500">Aucune transaction trouvée.</td></tr>
                    ) : null}
                    {transactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4 text-slate-600 text-sm">{t.date}</td>
                        <td className="p-4 font-medium text-slate-800">{t.description}</td>
                        <td className="p-4 text-slate-600"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs">{t.category}</span></td>
                        <td className={`p-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>{t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 rounded-full hover:bg-rose-50" title="Supprimer">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- VUE: DETTES --- */}
          {activeTab === 'debts' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-3xl p-6 text-white shadow-lg flex justify-between items-center">
                <div>
                  <p className="text-slate-300 font-medium mb-1">Total restant à payer</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-rose-400">{formatMoney(remainingDebts)}</h3>
                </div>
                <div className="flex flex-col items-end">
                  <CreditCard size={40} className="text-slate-400 mb-2 opacity-50" />
                  <button onClick={() => setShowDebtModal(true)} className="flex items-center space-x-1 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
                    <PlusCircle size={16} /> <span className="hidden md:inline">Nouvelle Dette</span><span className="md:hidden">Ajouter</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {debts.length === 0 ? (
                  <p className="text-slate-500 col-span-2 text-center py-8">Aucune dette enregistrée. Tout va bien !</p>
                ) : null}
                {debts.map(debt => {
                  const progress = Math.min((debt.paidAmount / debt.totalAmount) * 100, 100);
                  const remaining = debt.totalAmount - debt.paidAmount;
                  const isDone = remaining <= 0;
                  return (
                    <div key={debt.id} className={`p-6 rounded-3xl shadow-sm border transition-all ${isDone ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-slate-800 text-lg">{debt.name}</h4>
                        <div className="flex space-x-2">
                          {isDone ? <CheckCircle2 className="text-emerald-500" /> : null}
                          <button onClick={() => setDebts(prev => prev.filter(d => d.id !== debt.id))} className="text-slate-300 hover:text-rose-500"><Trash2 size={18}/></button>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-500">Payé: {formatMoney(debt.paidAmount)}</span>
                        <span className="font-medium text-slate-800">Total: {formatMoney(debt.totalAmount)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 mb-4 overflow-hidden">
                        <div className={`h-3 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100/50">
                        <span className={`text-sm font-medium ${isDone ? 'text-emerald-600' : 'text-rose-500'}`}>{isDone ? 'Soldé !' : `Reste: ${formatMoney(remaining)}`}</span>
                        {!isDone && (
                          <button onClick={() => setAmountModal({ type: 'debt', id: debt.id, title: debt.name, current: debt.paidAmount })} className="text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors">
                            + Paiement
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- VUE: OBJECTIFS ET BUDGET --- */}
          {activeTab === 'goals' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center"><Settings className="mr-2 text-amber-500" size={20} /> Budget Mensuel</h3>
                  <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <span className="text-sm font-medium text-slate-500">Limite:</span>
                    <input type="number" value={budgetLimit} onChange={handleUpdateBudget} className="w-24 bg-transparent text-right font-bold text-slate-800 focus:outline-none" />
                  </div>
                </div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-2xl font-bold text-slate-800">{formatMoney(totalExpenses)}</span>
                  <span className="text-sm font-medium text-slate-500">/ {formatMoney(budgetLimit)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                  <div className={`h-4 rounded-full transition-all duration-500 ${totalExpenses > budgetLimit ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((totalExpenses / budgetLimit) * 100, 100)}%` }}></div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 mb-4">
                <h3 className="text-xl font-bold text-slate-800">Objectifs d'épargne</h3>
                <button onClick={() => setShowGoalModal(true)} className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center space-x-1 text-sm bg-emerald-50 px-4 py-2 rounded-xl">
                  <PlusCircle size={16}/> <span className="hidden md:inline">Nouvel Objectif</span><span className="md:hidden">Nouveau</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {goals.length === 0 ? (
                  <p className="text-slate-500 col-span-2 text-center py-8">Aucun objectif défini. Fixez-vous un but !</p>
                ) : null}
                {goals.map(goal => {
                  const progress = Math.min((goal.savedAmount / goal.targetAmount) * 100, 100);
                  const isDone = progress >= 100;
                  return (
                    <div key={goal.id} className={`p-6 rounded-3xl shadow-sm border transition-all ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-slate-800 text-lg">{goal.name}</h4>
                        <button onClick={() => setGoals(prev => prev.filter(g => g.id !== goal.id))} className="text-slate-300 hover:text-rose-500"><Trash2 size={18}/></button>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-emerald-600 font-medium">Épargné: {formatMoney(goal.savedAmount)}</span>
                        <span className="text-slate-500">Cible: {formatMoney(goal.targetAmount)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 mb-4 overflow-hidden">
                        <div className={`h-3 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-400 font-medium">{progress.toFixed(1)}% complété</p>
                        {!isDone && (
                          <button onClick={() => setAmountModal({ type: 'goal', id: goal.id, title: goal.name, current: goal.savedAmount })} className="text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors">
                            + Fonds
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- VUE: RAPPORTS --- */}
          {activeTab === 'reports' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center space-y-4 animate-fade-in">
              <PieChartIcon size={64} className="mx-auto text-blue-200 mb-4" />
              <h3 className="text-2xl font-bold text-slate-800">Gestion des Données</h3>
              <p className="text-slate-600 max-w-md mx-auto">
                Vos données sont stockées sur votre appareil de manière ultra-rapide. {GOOGLE_SHEETS_URL && "Une copie de sauvegarde de vos transactions est envoyée automatiquement sur votre fichier Google Sheets."}
              </p>
              <div className="pt-6 flex justify-center space-x-4">
                <button onClick={exportData} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold shadow-md flex items-center space-x-2 transition-colors">
                  <Download size={20} /> <span>Télécharger copie locale (JSON)</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MOBILE NAV (Bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe z-40 rounded-t-3xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)]">
        {mobileNavItems.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center p-3 rounded-2xl ${activeTab === item.id ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}>
              <Icon size={24} /> <span className="text-[10px] mt-1 font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* --- MODALES --- */}

      {/* Modal: Transaction */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] md:p-4">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-xl font-bold text-slate-800">Nouvelle opération</h3>
              <button onClick={() => setShowTransactionModal(false)} className="text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-5">
              <div className="flex space-x-3">
                <button type="button" onClick={() => setNewTransaction({...newTransaction, type: 'expense', category: 'Alimentation'})} className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all ${newTransaction.type === 'expense' ? 'bg-rose-50 text-rose-600 border border-rose-100 shadow-sm' : 'bg-slate-50 text-slate-400 border border-transparent'}`}>Dépense (-)</button>
                <button type="button" onClick={() => setNewTransaction({...newTransaction, type: 'income', category: 'Salaire'})} className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all ${newTransaction.type === 'income' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm' : 'bg-slate-50 text-slate-400 border border-transparent'}`}>Revenu (+)</button>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Montant</label>
                <div className="relative">
                  <input type="number" required value={newTransaction.amount} onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})} className="w-full pl-4 pr-16 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
                  <span className="absolute right-5 top-4 text-slate-400 font-bold">XOF</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                <input type="text" required value={newTransaction.description} onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Achat fournitures" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Catégorie</label>
                  <select value={newTransaction.category} onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                    {newTransaction.type === 'expense' ? <><option>Alimentation</option><option>Transport</option><option>Loyer</option><option>Business/Pro</option><option>Loisirs</option><option>Autre</option></> : <><option>Salaire</option><option>Business/Ventes</option><option>Remboursement</option><option>Autre</option></>}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                  <input type="date" required value={newTransaction.date} onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <button type="submit" className={`w-full py-4 rounded-2xl text-white font-bold mt-2 shadow-lg transition-colors ${newTransaction.type === 'income' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-800 hover:bg-slate-900'}`}>Valider l'opération</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Dette */}
      {showDebtModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] md:p-4">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-lg">Ajouter une Dette</h3><button onClick={() => setShowDebtModal(false)} className="bg-slate-100 p-2 rounded-full"><X size={20}/></button></div>
            <form onSubmit={handleAddDebt} className="p-6 space-y-4">
              <div><label className="block text-sm font-bold mb-2 text-slate-700">Créancier / Motif</label><input required type="text" value={newDebt.name} onChange={e => setNewDebt({...newDebt, name: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Fournisseur XYZ" /></div>
              <div><label className="block text-sm font-bold mb-2 text-slate-700">Montant Total Dû</label><input required type="number" value={newDebt.totalAmount} onChange={e => setNewDebt({...newDebt, totalAmount: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" /></div>
              <button type="submit" className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-slate-900 transition-colors">Créer la dette</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Objectif */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] md:p-4">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-lg">Nouvel Objectif</h3><button onClick={() => setShowGoalModal(false)} className="bg-slate-100 p-2 rounded-full"><X size={20}/></button></div>
            <form onSubmit={handleAddGoal} className="p-6 space-y-4">
              <div><label className="block text-sm font-bold mb-2 text-slate-700">Nom de l'objectif</label><input required type="text" value={newGoal.name} onChange={e => setNewGoal({...newGoal, name: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex: Ordinateur pro" /></div>
              <div><label className="block text-sm font-bold mb-2 text-slate-700">Montant Cible</label><input required type="number" value={newGoal.targetAmount} onChange={e => setNewGoal({...newGoal, targetAmount: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0" /></div>
              <button type="submit" className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-emerald-600 transition-colors">Créer l'objectif</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ajout de Montant (Paiement dette ou Épargne) */}
      {amountModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] md:p-4">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-lg">{amountModal.type === 'debt' ? 'Ajouter un paiement' : 'Ajouter à l\'épargne'}</h3><button onClick={() => {setAmountModal(null); setAmountInput('');}} className="bg-slate-100 p-2 rounded-full"><X size={20}/></button></div>
            <form onSubmit={handleAddAmount} className="p-6 space-y-4">
              <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">Pour : <strong>{amountModal.title}</strong></p>
              <div>
                <label className="block text-sm font-bold mb-2 text-slate-700">Montant à ajouter</label>
                <input required type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} className={`w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-none focus:ring-2 ${amountModal.type === 'debt' ? 'focus:ring-blue-500' : 'focus:ring-emerald-500'}`} placeholder="0" />
              </div>
              <button type="submit" className={`w-full text-white py-4 rounded-2xl font-bold shadow-lg transition-colors ${amountModal.type === 'debt' ? 'bg-slate-800 hover:bg-slate-900' : 'bg-emerald-500 hover:bg-emerald-600'}`}>Valider l'ajout</button>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(100%); } md { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .pb-safe { padding-bottom: max(env(safe-area-inset-bottom), 16px); }
      `}} />
    </div>
  );
};

export default App;
