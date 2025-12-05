
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notifications } from '@/lib/patient-data';
import { Bell, Calendar, FileText, MessageSquare, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";

const iconMap = {
    appointment: <Calendar className="h-5 w-5 text-primary" />,
    report: <FileText className="h-5 w-5 text-green-500" />,
    payment: <CreditCard className="h-5 w-5 text-red-500" />,
    message: <MessageSquare className="h-5 w-5 text-blue-500" />,
};

export default function NotificationsPage() {
    const sectionVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: (i: number) => ({
            opacity: 1,
            x: 0,
            transition: {
                delay: i * 0.1,
            },
        }),
    };

    return (
        <motion.div
            className="space-y-8 max-w-4xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
        >
            <div>
                <h1 className="text-3xl font-bold font-headline">Notifications</h1>
                <p className="text-muted-foreground">Stay updated with important alerts and messages.</p>
            </div>

            <Card>
                <CardContent className="p-0">
                    <ul className="divide-y">
                        {notifications.map((notification, i) => (
                            <motion.li
                                key={notification.id}
                                custom={i}
                                initial="hidden"
                                animate="visible"
                                variants={itemVariants}
                                className={`p-4 flex items-start gap-4 transition-colors hover:bg-accent ${!notification.read ? 'bg-primary/5' : ''}`}
                            >
                                <div className="p-2 bg-secondary rounded-full">
                                    {iconMap[notification.type]}
                                </div>
                                <div className="flex-grow">
                                    <p className="font-medium">{notification.message}</p>
                                    <p className="text-sm text-muted-foreground">{notification.timestamp}</p>
                                </div>
                                {!notification.read && (
                                    <Badge variant="default" className="h-6">New</Badge>
                                )}
                            </motion.li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </motion.div>
    );
}
