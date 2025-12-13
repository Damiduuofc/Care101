"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Calendar, FileText, MessageSquare, CreditCard, Clock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/notifications`;

const iconMap: any = {
    appointment: <Calendar className="h-5 w-5 text-primary" />,
    report: <FileText className="h-5 w-5 text-green-500" />,
    payment: <CreditCard className="h-5 w-5 text-purple-500" />,
    message: <MessageSquare className="h-5 w-5 text-blue-500" />,
    reminder: <Clock className="h-5 w-5 text-orange-500" />,
};

export default function NotificationsPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotifications = async () => {
            const token = sessionStorage.getItem("token");
            if (!token) { router.push("/login"); return; }

            try {
                // ✅ Correct: Fetch data from the backend URL
                const res = await fetch(API_URL, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    setNotifications(await res.json());
                }
            } catch (error) {
                console.error("Failed to load notifications");
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, [router]);

    const markAsRead = async (id: string) => {
        const token = sessionStorage.getItem("token");
        try {
            await fetch(`${API_URL}/read/${id}`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.error("Error updating notification");
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-cyan-600 h-8 w-8" /></div>;

    return (
        <motion.div className="space-y-8 max-w-4xl mx-auto p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div>
                <h1 className="text-3xl font-bold font-headline text-slate-900">Notifications</h1>
                <p className="text-slate-500">Stay updated with important alerts.</p>
            </div>

            <Card>
                <CardContent className="p-0">
                    {notifications.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                            {notifications.map((notification) => (
                                <li
                                    key={notification._id}
                                    onClick={() => !notification.read && markAsRead(notification._id)}
                                    className={`p-5 flex items-start gap-4 hover:bg-slate-50 cursor-pointer transition-colors ${!notification.read ? 'bg-cyan-50/40' : ''}`}
                                >
                                    <div className={`p-2 rounded-full ${!notification.read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                        {iconMap[notification.type] || <Bell className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-grow">
                                        <p className={`text-sm ${!notification.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {new Date(notification.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    {!notification.read && <Badge className="bg-cyan-600">New</Badge>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-12 text-slate-400">No new notifications.</div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}