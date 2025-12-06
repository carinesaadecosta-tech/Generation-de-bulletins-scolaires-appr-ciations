import React, { useState, useRef } from 'react';
import { Plus, Trash2, Wand2, Download, BookOpen, AlertCircle, CheckCircle2, Upload, FileSpreadsheet, FileText, HelpCircle } from 'lucide-react';
import { generateAppreciations } from './services/geminiService';
import { Student, Gender, Level, Behavior, Investment, GeneratedResponseItem } from './types';
import { Tooltip } from './components/Tooltip';
import { read, utils, writeFile } from 'xlsx';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [subject, setSubject] = useState<string>('Mathématiques');
  const [students, setStudents] = useState<Student[]>([
    {
      id: generateId(),
      name: '',
      gender: Gender.MALE,
      level: Level.MOYEN,
      behavior: Behavior.AGREABLE,
      investment: Investment.SERIEUX,
      skills: '',
      advice: '',
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addStudent = () => {
    setStudents([
      ...students,
      {
        id: generateId(),
        name: '',
        gender: Gender.MALE, // Default
        level: Level.BON,
        behavior: Behavior.AGREABLE,
        investment: Investment.SERIEUX,
        skills: '',
        advice: '',
      }
    ]);
  };

  const removeStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
  };

  const updateStudent = (id: string, field: keyof Student, value: string) => {
    setStudents(students.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // --- Excel Import Logic ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const findBestMatch = (value: string, enumObject: any, defaultValue: any) => {
    if (!value) return defaultValue;
    const normalizedValue = String(value).toLowerCase().trim();
    // Check values
    for (const key in enumObject) {
        if (enumObject[key].toLowerCase() === normalizedValue) return enumObject[key];
    }
    // Simple heuristic for gender
    if (enumObject === Gender) {
        if (normalizedValue === 'f' || normalizedValue.startsWith('fil')) return Gender.FEMALE;
        if (normalizedValue === 'm' || normalizedValue === 'g' || normalizedValue.startsWith('gar')) return Gender.MALE;
    }
    return defaultValue;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const data = await file.arrayBuffer();
        const workbook = read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            setError("Le fichier Excel semble vide.");
            return;
        }

        const newStudents: Student[] = jsonData.map((row: any) => ({
            id: generateId(),
            name: row['Prénom'] || row['Prenom'] || row['Nom'] || row['Name'] || '',
            gender: findBestMatch(row['Genre'] || row['Sexe'], Gender, Gender.MALE),
            level: findBestMatch(row['Niveau'], Level, Level.MOYEN),
            behavior: findBestMatch(row['Comportement'], Behavior, Behavior.AGREABLE),
            investment: findBestMatch(row['Investissement'], Investment, Investment.SERIEUX),
            skills: row['Compétences'] || row['Points forts'] || '',
            advice: row['Conseils'] || row['Conseil'] || '',
        })).filter((s: Student) => s.name); // Keep only rows with names

        if (newStudents.length > 0) {
            // Check if current list is empty/default, if so replace, else append
            if (students.length === 1 && students[0].name === '') {
                setStudents(newStudents);
            } else {
                setStudents(prev => [...prev, ...newStudents]);
            }
            setError(null);
        } else {
            setError("Aucun élève valide trouvé dans le fichier. Vérifiez les colonnes (Prénom, etc.).");
        }
    } catch (err) {
        console.error(err);
        setError("Erreur lors de la lecture du fichier Excel.");
    } finally {
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const ws = utils.json_to_sheet([
        { 
            'Prénom': 'Jean', 
            'Genre': 'Garçon', 
            'Niveau': 'Bon', 
            'Comportement': 'Agréable', 
            'Investissement': 'Sérieux et régulier', 
            'Compétences': 'Calcul mental', 
            'Conseils': 'Continuer ainsi' 
        },
        { 
            'Prénom': 'Marie', 
            'Genre': 'Fille', 
            'Niveau': 'Excellent', 
            'Comportement': 'Exemplaire', 
            'Investissement': 'Sérieux et régulier', 
            'Compétences': '', 
            'Conseils': '' 
        }
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Modèle");
    writeFile(wb, "Modele_Import_Eleves.xlsx");
  };

  // --- Excel Export Logic ---
  const handleExportExcel = () => {
    const studentsWithComments = students.filter(s => s.generatedComment);
    
    if (studentsWithComments.length === 0) return;

    const dataToExport = studentsWithComments.map(s => ({
        'Prénom': s.name,
        'Genre': s.gender,
        'Niveau': s.level,
        'Comportement': s.behavior,
        'Investissement': s.investment,
        'Points Forts': s.skills,
        'Conseils': s.advice,
        'Matière': subject,
        'Appréciation': s.generatedComment
    }));

    const ws = utils.json_to_sheet(dataToExport);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Appréciations");
    
    // Auto-width for columns
    const wscols = Object.keys(dataToExport[0]).map(key => ({ wch: 20 }));
    // Adjust specific columns
    wscols[0] = { wch: 15 }; // Name
    wscols[8] = { wch: 80 }; // Appréciation
    ws['!cols'] = wscols;

    writeFile(wb, `Bulletins_${subject.replace(/\s+/g, '_')}.xlsx`);
  };

  // --- PDF Export Logic ---
  const handleExportPDF = () => {
    const studentsWithComments = students.filter(s => s.generatedComment);
    if (studentsWithComments.length === 0) return;

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(`Bulletins Scolaires - ${subject}`, 14, 20);
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Généré le ${new Date().toLocaleDateString()}`, 14, 28);

    // Table Data
    const tableData = studentsWithComments.map(s => [
        s.name,
        s.level,
        s.behavior,
        s.generatedComment || ''
    ]);

    // Generate Table
    autoTable(doc, {
        startY: 35,
        head: [['Prénom', 'Niveau', 'Comportement', 'Appréciation']],
        body: tableData,
        headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        columnStyles: {
            0: { cellWidth: 30 }, // Prénom
            1: { cellWidth: 25 }, // Niveau
            2: { cellWidth: 35 }, // Comportement
            3: { cellWidth: 'auto' } // Appréciation
        },
        styles: { 
            font: "helvetica",
            fontSize: 10,
            overflow: 'linebreak',
            cellPadding: 4
        },
    });

    doc.save(`Bulletins_${subject.replace(/\s+/g, '_')}.pdf`);
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    
    // Basic validation
    if (!subject.trim()) {
        setError("Veuillez indiquer une matière.");
        setIsGenerating(false);
        return;
    }
    const validStudents = students.filter(s => s.name.trim() !== '');
    if (validStudents.length === 0) {
        setError("Veuillez ajouter au moins un élève avec un prénom.");
        setIsGenerating(false);
        return;
    }

    try {
      const results: GeneratedResponseItem[] = await generateAppreciations(subject, validStudents);
      
      // Merge results back into state
      setStudents(prevStudents => prevStudents.map(student => {
        const result = results.find(r => r.id === student.id);
        return result ? { ...student, generatedComment: result.comment } : student;
      }));

      // Scroll to results if any were generated
      setTimeout(() => {
        if(resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);

    } catch (e: any) {
      setError("Une erreur est survenue lors de la génération. Vérifiez votre clé API ou réessayez.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const hasResults = students.some(s => s.generatedComment);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="text-indigo-600 w-6 h-6" />
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">Générateur de Bulletins</h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600 hidden sm:block">Matière :</label>
                <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Français, Maths..."
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-40 sm:w-64 transition-all"
                />
             </div>
             <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-white font-medium text-sm shadow-sm transition-all
                  ${isGenerating 
                    ? 'bg-indigo-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
             >
                {isGenerating ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Génération...</span>
                    </>
                ) : (
                    <>
                        <Wand2 className="w-4 h-4" />
                        <span>Générer</span>
                    </>
                )}
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Intro / Instructions */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <p>
            Remplissez le tableau ci-dessous manuellement ou importez une liste Excel. 
            L'IA rédigera des appréciations complètes et bienveillantes.
          </p>
          <div className="flex gap-2">
            <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 text-xs font-medium text-indigo-700 hover:text-indigo-900 underline"
            >
                <Download className="w-3 h-3" />
                Télécharger un modèle Excel
            </button>
          </div>
        </div>

        {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
            </div>
        )}

        {/* Input Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 w-[150px]">Prénom</th>
                  <th className="p-4 w-[100px]">Genre</th>
                  <th className="p-4 w-[140px]">Niveau</th>
                  <th className="p-4 w-[220px]">Comportement</th>
                  <th className="p-4 w-[160px]">Investissement</th>
                  <th className="p-4 min-w-[200px]">Points forts / Compétences</th>
                  <th className="p-4 min-w-[200px]">Conseils / À améliorer</th>
                  <th className="p-4 w-[50px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-3">
                      <input
                        type="text"
                        value={student.name}
                        onChange={(e) => updateStudent(student.id, 'name', e.target.value)}
                        placeholder="Prénom"
                        className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-slate-900 placeholder-slate-400 py-1 transition-colors"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={student.gender}
                        onChange={(e) => updateStudent(student.id, 'gender', e.target.value as Gender)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none"
                      >
                        {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                       <select
                        value={student.level}
                        onChange={(e) => updateStudent(student.id, 'level', e.target.value as Level)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none"
                      >
                        {Object.values(Level).map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                        <select
                        value={student.behavior}
                        onChange={(e) => updateStudent(student.id, 'behavior', e.target.value as Behavior)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none truncate"
                        title={student.behavior}
                      >
                        {Object.values(Behavior).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </td>
                     <td className="p-3">
                        <select
                        value={student.investment}
                        onChange={(e) => updateStudent(student.id, 'investment', e.target.value as Investment)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none truncate"
                      >
                        {Object.values(Investment).map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                        <input
                        type="text"
                        value={student.skills}
                        onChange={(e) => updateStudent(student.id, 'skills', e.target.value)}
                        placeholder="Ex: calcul mental..."
                        className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none"
                      />
                    </td>
                    <td className="p-3">
                         <input
                        type="text"
                        value={student.advice}
                        onChange={(e) => updateStudent(student.id, 'advice', e.target.value)}
                        placeholder="Ex: participer plus..."
                        className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none"
                      />
                    </td>
                    <td className="p-3 text-center">
                      {students.length > 1 && (
                        <button
                          onClick={() => removeStudent(student.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center">
            <button
              onClick={addStudent}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter un élève
            </button>

            <button
                onClick={handleImportClick}
                className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                title="Format attendu : Colonnes 'Prénom', 'Genre', etc."
            >
                <Upload className="w-4 h-4" />
                Importer liste Excel
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div ref={resultsRef} className="space-y-4">
            {(hasResults) && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Appréciations Générées
                    </h2>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleExportExcel}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-slate-300 bg-white text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-all shadow-sm"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Exporter Excel
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-slate-300 bg-white text-red-700 text-sm font-medium hover:bg-red-50 transition-all shadow-sm"
                        >
                            <FileText className="w-4 h-4" />
                            Exporter PDF
                        </button>
                    </div>
                </div>
            )}
            
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                {students
                    .filter(s => s.generatedComment)
                    .map((student) => (
                    <div key={student.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-slate-900">{student.name || 'Élève sans nom'}</h3>
                                <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-1">
                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">{student.level}</span>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{student.behavior}</span>
                                </div>
                            </div>
                            <Tooltip text="Copier">
                                <button 
                                    onClick={() => copyToClipboard(student.generatedComment || "")}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                             <p className="text-slate-700 leading-relaxed text-sm">
                                {student.generatedComment}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;