import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { SendEmail } from "@/integrations/Core";
import { User } from '@/entities/User';
import { useTranslation } from "../components/LanguageProvider";

export default function ContactUs() {
  const [formData, setFormData] = useState({ subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await User.me();
      if (!user) {
        toast({
          title: "Error",
          description: "Please sign in to send a message",
          variant: "destructive"
        });
        return;
      }

      // Contact email address is now set to the requested address
      const contactEmail = "support@appvideovault.com";

      await SendEmail({
        to: contactEmail,
        subject: `Contact Form: ${formData.subject}`,
        body: `From: ${user.email}\n\nMessage:\n${formData.message}`
      });

      toast({
        title: "Message Sent",
        description: "We'll get back to you soon!",
      });

      setFormData({ subject: '', message: '' });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Could not send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("Home")}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Contact Us</h1>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Subject</label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="What would you like to discuss?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tell us how we can help..."
              rows={6}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </form>
      </Card>

      <div className="mt-8 text-center text-gray-600">
        <Mail className="h-6 w-6 mx-auto mb-2" />
        <p>We'll get back to you as soon as possible.</p>
      </div>
    </div>
  );
}