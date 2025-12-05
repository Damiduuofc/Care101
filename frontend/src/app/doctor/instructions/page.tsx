"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Upload, Video, Mic, FileText, Save, Edit, Trash } from 'lucide-react';
import { surgeryInstructions } from '@/lib/doctor-data';
import { motion, AnimatePresence } from 'framer-motion';

type Instruction = typeof surgeryInstructions[0];

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState(surgeryInstructions);
  const [selectedInstruction, setSelectedInstruction] = useState<Instruction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSave = (newInstruction: { surgeryName: string, description: string }) => {
    const newId = instructions.length > 0 ? Math.max(...instructions.map(i => i.id)) + 1 : 1;
    const instructionToAdd: Instruction = {
        id: newId,
        ...newInstruction,
        preOp: { video: null, audio: null, document: null },
        postOp: { video: null, audio: null, document: null }
    };
    setInstructions([instructionToAdd, ...instructions]);
    setIsFormOpen(false);
  };
  
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div 
        className="space-y-8"
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
    >
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold font-headline">Surgery Instructions</h1>
            <p className="text-muted-foreground">Create and manage pre and post-operation patient instructions.</p>
        </div>
        <Button onClick={() => { setSelectedInstruction(null); setIsFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Instruction
        </Button>
      </div>

      <AnimatePresence>
        {isFormOpen && (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
            >
                <InstructionForm onSave={handleSave} onCancel={() => setIsFormOpen(false)} />
            </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Saved Instructions</h2>
            {instructions.map(inst => (
                <Card 
                    key={inst.id} 
                    className={`cursor-pointer transition-all ${selectedInstruction?.id === inst.id ? 'border-primary shadow-lg' : 'hover:bg-accent'}`}
                    onClick={() => setSelectedInstruction(inst)}
                >
                    <CardHeader>
                        <CardTitle>{inst.surgeryName}</CardTitle>
                    </CardHeader>
                </Card>
            ))}
        </div>
        
        <div>
            {selectedInstruction ? (
                <InstructionDetails instruction={selectedInstruction} />
            ) : (
                <Card className="h-full flex items-center justify-center text-center">
                    <CardContent className="p-6">
                        <p className="text-muted-foreground">Select an instruction from the list to view its details and upload media.</p>
                    </CardContent>
                </Card>
            )}
        </div>
      </div>
    </motion.div>
  );
}

function InstructionForm({ onSave, onCancel }: { onSave: (data: { surgeryName: string, description: string }) => void, onCancel: () => void }) {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name && desc) {
            onSave({ surgeryName: name, description: desc });
            setName('');
            setDesc('');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Add New Surgery Instruction</CardTitle>
                <CardDescription>Provide the name and a brief description for the surgery.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input placeholder="Surgery Name (e.g., Appendectomy)" value={name} onChange={e => setName(e.target.value)} required />
                    <Textarea placeholder="Brief description of the surgery..." value={desc} onChange={e => setDesc(e.target.value)} required />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                        <Button type="submit"><Save className="mr-2 h-4 w-4"/> Save Instruction</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function InstructionDetails({ instruction }: { instruction: Instruction }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{instruction.surgeryName}</CardTitle>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4"/></Button>
                    </div>
                </div>
                <CardDescription>{instruction.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <InstructionSection title="Pre-Operation" media={instruction.preOp} />
                <InstructionSection title="Post-Operation" media={instruction.postOp} />
            </CardContent>
        </Card>
    );
}

function InstructionSection({ title, media }: { title: string, media: Instruction['preOp'] }) {
    return (
        <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">{title} Instructions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MediaUploadSlot type="video" existingMedia={media.video} />
                <MediaUploadSlot type="audio" existingMedia={media.audio} />
                <MediaUploadSlot type="document" existingMedia={media.document} />
            </div>
        </div>
    );
}

function MediaUploadSlot({ type, existingMedia }: { type: 'video' | 'audio' | 'document', existingMedia: string | null }) {
    const icons = {
        video: <Video className="h-8 w-8 text-muted-foreground" />,
        audio: <Mic className="h-8 w-8 text-muted-foreground" />,
        document: <FileText className="h-8 w-8 text-muted-foreground" />,
    };

    return (
        <div className="flex flex-col items-center justify-center space-y-2 p-4 border-2 border-dashed rounded-md text-center">
            {icons[type]}
            <p className="text-sm capitalize">{type}</p>
            {existingMedia ? (
                 <div className="text-xs text-green-600 font-medium">Uploaded</div>
            ) : (
                <Button variant="outline" size="sm" className="mt-2">
                    <Upload className="mr-2 h-3 w-3" /> Upload
                </Button>
            )}
        </div>
    );
}
